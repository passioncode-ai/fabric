// What a session is told BEFORE it asks (M123, the half the tool contract left).
//
// Fabric hands an agent its tools and, until this file existed, hoped it would
// call `fabric_whoami`. The hope had one thread behind it: the sentence "Call
// this first" inside a tool description, which an agent may never read and
// certainly need not obey. An agent that never calls whoami never learns that it
// may not close its own task, that a note is not documentation, and that
// spending money needs a person — and it learns none of that in a way anyone
// notices.
//
// THE ORCA LESSON, which this repository recorded before it had a use for it:
// the stub on disk says only "call the tools"; the version-matched contract is
// what the running binary returns. A document cannot drift from the binary when
// the binary IS the document. So this text is deliberately incapable of holding
// a rule — it points at where the rules live and stops. `preamble.test.ts`
// enforces exactly that, because the pressure to paste "and remember not to…"
// into a system prompt is constant and always feels harmless.

export const PREAMBLE =
  'You are running inside Fabric, which is watching this session and holds the ' +
  'rules that apply to it. Call the fabric_whoami tool before you do anything ' +
  'else: it returns this project, what Fabric already remembers about it, the ' +
  'task you were opened for if there is one, and the rules for this session. ' +
  'Those rules are current and anything you recall about how Fabric works is ' +
  'not. If the call fails, say so and stop rather than guessing what it would ' +
  'have said.'

/** The one tool the stub is allowed to name. Anything else is a rule living in
 *  two places, and the second copy is the one that goes stale. */
export const NAMED_TOOL = 'fabric_whoami'
