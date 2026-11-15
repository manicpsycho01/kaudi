"use client";
import { Heist } from "./Heist";
import { Replayable } from "./Replayable";
import { Sea } from "./Sea";

export const SeaApp = () => <Replayable>{(run) => <Sea replay={run} />}</Replayable>;
export const HeistApp = () => <Replayable>{(run) => <Heist replay={run ?? undefined} />}</Replayable>;
