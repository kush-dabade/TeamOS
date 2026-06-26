import "dotenv/config";

import "./queues/email/email.worker.js";
import "./queues/notification/notification.worker.js";

console.log("Email worker started.");
console.log("Notification worker started.");