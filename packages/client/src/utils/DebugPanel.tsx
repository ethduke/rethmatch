import { DEBUG_ITER, findOrThrow, mapEntityToEmoji } from "./debugging";
import { LineState, GameConfig } from "./game/configLib";
import { Entity, computeCollisionTime } from "./game/entityLib";
import { timeWad } from "./timeLib";
import { GameButton } from "./button"; // Import GameButton

export function DebugPanel({
  lastProcessedTime,
  line,
  lineState,
  gameConfig,
}: {
  lastProcessedTime: bigint;
  line: Entity[];
  lineState: LineState;
  gameConfig: GameConfig;
}) {
  return (
    <div>
      <h3>
        Last proc'd time: {lastProcessedTime.fromWad().toFixed(2)}
        Current time: {timeWad().fromWad().toFixed(2)}
        <br />
        <br />
        Collision queue{" "}
        <GameButton
          disabled={DEBUG_ITER === 0}
          onClick={() => {
            const urlParams = new URLSearchParams(window.location.search);
            urlParams.set("debug_iter", (DEBUG_ITER! - 1).toString());

            window.history.replaceState(
              null,
              "",
              `${window.location.pathname}?${urlParams.toString()}`
            );

            window.location.replace(window.location.href);
          }}
        >
          Previous iteration
        </GameButton>
        <GameButton
          style={{ marginLeft: "5px" }}
          onClick={() => {
            const urlParams = new URLSearchParams(window.location.search);
            urlParams.set("debug_iter", (DEBUG_ITER! + 1).toString());

            window.history.replaceState(
              null,
              "",
              `${window.location.pathname}?${urlParams.toString()}`
            );

            window.location.replace(window.location.href);
          }}
        >
          Next iteration
        </GameButton>
      </h3>
      {lineState.collisionQueue.map((entry, j) => {
        const rightEntity = line.find((e) => e.entityId === entry.value);

        const leftEntity = rightEntity ? findOrThrow(line, rightEntity.leftNeighbor) : null;
        const colTime =
          leftEntity && rightEntity
            ? computeCollisionTime(leftEntity, rightEntity, gameConfig.velocityCoefficient)
            : null;

        return (
          <div key={j}>
            Time until: <b>{(entry.priority - lastProcessedTime).fromWad().toFixed(2)}</b> |
            Entities:{" "}
            <b>
              {colTime != entry.priority ? "<STALE>" : mapEntityToEmoji(leftEntity!.entityId)}
              {" ← "}
              {mapEntityToEmoji(entry.value)}
            </b>
          </div>
        );
      })}
      <br />
      <br />
      Entities:
      {line.map((e) => {
        return (
          <div key={e.entityId.toString()}>
            E: {mapEntityToEmoji(e.entityId)} — LEFT NEIGHBOR: {mapEntityToEmoji(e.leftNeighbor)} —
            RIGHT NEIGHBOR: {mapEntityToEmoji(e.rightNeighbor)}
          </div>
        );
      })}
    </div>
  );
}
