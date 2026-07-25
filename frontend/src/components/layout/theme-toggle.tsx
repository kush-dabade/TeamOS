import { Monitor, Moon, Sun, SunMoon } from "lucide-react";
import type { ComponentType } from "react";

import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme, type Theme } from "@/providers/theme-provider";

const THEME_OPTIONS: { value: Theme; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

function isThemeOption(value: string): value is Theme {
  return THEME_OPTIONS.some((option) => option.value === value);
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  function handleValueChange(value: string) {
    if (isThemeOption(value)) {
      setTheme(value);
    }
  }

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <SunMoon className="size-4" />
        Appearance
      </DropdownMenuSubTrigger>

      <DropdownMenuSubContent>
        <DropdownMenuRadioGroup value={theme} onValueChange={handleValueChange}>
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon className="size-4" />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
