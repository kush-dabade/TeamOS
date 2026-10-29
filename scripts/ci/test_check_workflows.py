"""Proves check-workflows.py rejects the changes that would let untrusted code
publish or deploy: each test copies .github/ to a scratch directory, breaks
one rule, and expects the checker to fail with that rule's message.

Run: python3 -m unittest discover -s scripts/ci -p 'test_*.py'
"""

import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
CHECKER = ROOT / "scripts" / "ci" / "check-workflows.py"


class WorkflowPolicyTest(unittest.TestCase):
    def setUp(self):
        self.scratch = Path(tempfile.mkdtemp())
        shutil.copytree(ROOT / ".github", self.scratch / ".github")

    def tearDown(self):
        shutil.rmtree(self.scratch)

    def edit(self, workflow, change):
        path = self.scratch / ".github" / "workflows" / workflow
        document = yaml.safe_load(path.read_text())
        change(document)
        path.write_text(yaml.safe_dump(document, sort_keys=False))

    def check(self):
        return subprocess.run(
            [sys.executable, str(CHECKER), str(self.scratch)], capture_output=True, text=True
        )

    def assertRejected(self, message):
        result = self.check()
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn(message, result.stdout)

    def test_repository_workflows_pass(self):
        result = self.check()
        self.assertEqual(result.returncode, 0, result.stdout)

    def test_release_cannot_run_for_pull_requests(self):
        self.edit("release.yml", lambda w: w["on"].update({"pull_request": None}))
        self.assertRejected("must trigger only on push to main")

    def test_release_cannot_run_for_other_branches(self):
        self.edit("release.yml", lambda w: w["on"]["push"].update({"branches": ["main", "feature/*"]}))
        self.assertRejected("must trigger only on push to main")

    def test_pull_request_jobs_cannot_write_packages(self):
        self.edit(
            "production-ci.yml",
            lambda w: w["jobs"]["images"].update({"permissions": {"contents": "read", "packages": "write"}}),
        )
        self.assertRejected("only release.yml's publish job may write packages")

    def test_pull_request_workflows_cannot_push_images(self):
        def push(workflow):
            for step in workflow["jobs"]["images"]["steps"]:
                if str(step.get("uses", "")).startswith("docker/build-push-action@"):
                    step["with"]["push"] = True

        self.edit("production-ci.yml", push)
        self.assertRejected("is triggered by pull_request but pushes images")

    def test_pull_request_workflows_cannot_deploy(self):
        self.edit(
            "production-ci.yml",
            lambda w: w["jobs"]["tooling"]["steps"].append({"uses": "./.github/actions/vm-run"}),
        )
        self.assertRejected("is triggered by pull_request but runs a release action on the VM")

    def test_pull_request_workflows_cannot_use_secrets(self):
        self.edit(
            "frontend-ci.yml",
            lambda w: w["jobs"]["frontend-ci"]["env"].update({"TOKEN": "${{ secrets.SOME_TOKEN }}"}),
        )
        self.assertRejected("is triggered by pull_request but uses secrets")

    def test_only_deploy_jobs_get_oidc_tokens(self):
        self.edit(
            "backend-ci.yml",
            lambda w: w["jobs"]["backend-ci"].update({"permissions": {"contents": "read", "id-token": "write"}}),
        )
        self.assertRejected("only the deploy and production-check jobs may request OIDC tokens")

    def test_pull_request_target_is_rejected(self):
        self.edit("frontend-ci.yml", lambda w: w["on"].update({"pull_request_target": None}))
        self.assertRejected("pull_request_target")

    def test_deploy_needs_publish_and_production_environment(self):
        def loosen(workflow):
            deploy = workflow["jobs"]["deploy"]
            deploy["needs"] = []
            deploy.pop("environment")

        self.edit("release.yml", loosen)
        self.assertRejected("release.yml deploy: must need publish")
        self.assertRejected("must use the production environment")

    def test_deploys_are_never_cancelled_midway(self):
        self.edit(
            "release.yml",
            lambda w: w["jobs"]["deploy"]["concurrency"].update({"cancel-in-progress": True}),
        )
        self.assertRejected("non-cancelling production-deploy concurrency group")

    def test_deploy_cannot_lose_the_first_release_gate(self):
        self.edit("release.yml", lambda w: w["jobs"]["deploy"].pop("if"))
        self.assertRejected("must be gated by `if: needs.publish.outputs.deploy == 'true'`")

    def test_deploy_gate_cannot_fail_open(self):
        # A missing or misspelt variable must keep deploy off, not turn it on.
        self.edit(
            "release.yml",
            lambda w: w["jobs"]["deploy"].update({"if": "needs.publish.outputs.deploy != 'false'"}),
        )
        self.assertRejected("must be gated by")

    def test_deploy_gate_cannot_read_the_variable_directly(self):
        # Expressions compare case-insensitively, so `TRUE` would pass this.
        self.edit(
            "release.yml",
            lambda w: w["jobs"]["deploy"].update({"if": "vars.PRODUCTION_AUTO_DEPLOY == 'true'"}),
        )
        self.assertRejected("must be gated by")

    def test_deploy_gate_must_come_from_the_config_step(self):
        self.edit("release.yml", lambda w: w["jobs"]["publish"]["outputs"].update({"deploy": "true"}))
        self.assertRejected("output `deploy` must come from the config step")

    def test_production_check_only_runs_from_main(self):
        self.edit("production-check.yml", lambda w: w["jobs"]["check"].pop("if"))
        self.assertRejected("must only run from main")

    def test_production_check_cannot_be_triggered_by_pushes(self):
        self.edit("production-check.yml", lambda w: w["on"].update({"push": None}))
        self.assertRejected("must only be started by hand")

    def test_actions_must_be_pinned_to_a_commit(self):
        def unpin(workflow):
            workflow["jobs"]["frontend-ci"]["steps"][0]["uses"] = "actions/checkout@v4"

        self.edit("frontend-ci.yml", unpin)
        self.assertRejected("is not pinned to a full commit SHA")


class FirstReleaseGateTest(unittest.TestCase):
    """Runs release.yml's real publish config step, as the runner would, for
    each value PRODUCTION_AUTO_DEPLOY can have."""

    ORIGIN = "https://teamos.example.test"

    @classmethod
    def setUpClass(cls):
        release = yaml.safe_load((ROOT / ".github" / "workflows" / "release.yml").read_text())
        steps = release["jobs"]["publish"]["steps"]
        cls.script = next(step["run"] for step in steps if step.get("id") == "config")

    def run_gate(self, value=None, origin=ORIGIN):
        with tempfile.NamedTemporaryFile("r", suffix=".out") as output:
            env = {"PATH": "/usr/bin:/bin", "GITHUB_OUTPUT": output.name, "PUBLIC_ORIGIN": origin}
            # The runner sets an unset variable to the empty string.
            env["PRODUCTION_AUTO_DEPLOY"] = "" if value is None else value
            result = subprocess.run(
                ["bash", "-e", "-c", self.script], env=env, capture_output=True, text=True
            )
            return result, output.read()

    def test_unset_publishes_without_deploying(self):
        result, output = self.run_gate()
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertEqual(output, "deploy=false\n")
        self.assertIn("Automatic deployment is off", result.stdout)

    def test_false_publishes_without_deploying(self):
        result, output = self.run_gate("false")
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertEqual(output, "deploy=false\n")

    def test_true_deploys(self):
        result, output = self.run_gate("true")
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertEqual(output, "deploy=true\n")

    def test_anything_else_fails_closed(self):
        for value in ("TRUE", "True", "yes", "1", "on", " true", "true ", "true\n", "false-ish"):
            with self.subTest(value=value):
                result, output = self.run_gate(value)
                self.assertEqual(result.returncode, 1, result.stdout)
                self.assertNotIn("deploy=true", output)
                self.assertIn("PRODUCTION_AUTO_DEPLOY is invalid", result.stdout)

    def test_missing_origin_stops_before_the_gate(self):
        result, output = self.run_gate("true", origin="")
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertEqual(output, "")


if __name__ == "__main__":
    unittest.main()
