import { appRoutes } from "./app.routes";
import { publicRoutes } from "./public.routes";

export const routes = [...publicRoutes, ...appRoutes];
