import "regenerator-runtime/runtime";
import "./style.css";
import { App } from "./app.js";

document.addEventListener("DOMContentLoaded", () => {
  const app = new App();
  app.init();
});
