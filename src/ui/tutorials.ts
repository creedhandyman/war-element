/** Every scripted battle, by id, in the order the Training Ground's Basics lists
 *  them. Each is a `TutorialDef` (ui/tutorial.ts); the App, the rail and the
 *  replay test drive them all the same way. */
import { BASICS, type TutorialDef, type TutorialId } from "./tutorial";
import { MAGIC } from "./tutorial-magic";

export const TUTORIALS: Record<TutorialId, TutorialDef> = { basics: BASICS, magic: MAGIC };
export const TUTORIAL_ORDER: readonly TutorialId[] = ["basics", "magic"];
