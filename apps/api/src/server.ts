import { app } from "./app.js";
import { env } from "./config/env.js";
import { integrations } from "./services/integrations.js";

app.listen(env.PORT, () => {
  console.log(
    JSON.stringify({
      service: "laborforce-api",
      port: env.PORT,
      integrations
    })
  );
});
