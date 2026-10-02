import "./styles.css";
import { readParams } from "./params.ts";
import { mountMenu } from "./screens/menu.ts";

const appEl = document.getElementById("app")!;

function main(): void {
  const params = readParams(location.search, Math.floor(Math.random() * 2 ** 32));
  console.log("params:", params);

  if (params.room !== null) {
    console.log("room param:", params.room);
  }

  mountMenu(appEl, {
    onPlayAi(difficulty: string) {
      console.log("starting AI game, difficulty:", difficulty);
    },
    onPlayOnline() {
      console.log("starting online game");
    },
  });
}

main();
