/**
 * Scenarios registry — registers all Judge Mode scenarios.
 * Implements phase-7-agents-judge-mode-mcp.md §7.3 & AIP-13 Express Lane.
 */
import { registerScenario } from '@/demo/runner'
import { happyPathScenario } from './happy_path'
import { rejectThenPassScenario } from './reject_then_pass'
import { injectionAttackScenario } from './injection_attack'
import { captureDeclinedScenario } from './capture_declined'
import { silentBuyerAutoreleaseScenario } from './silent_buyer_autorelease'
import { expressHappyPathScenario } from './express_happy_path'

// Register all scenarios
registerScenario(happyPathScenario)
registerScenario(rejectThenPassScenario)
registerScenario(injectionAttackScenario)
registerScenario(captureDeclinedScenario)
registerScenario(silentBuyerAutoreleaseScenario)
registerScenario(expressHappyPathScenario)

export {
  happyPathScenario,
  rejectThenPassScenario,
  injectionAttackScenario,
  captureDeclinedScenario,
  silentBuyerAutoreleaseScenario,
  expressHappyPathScenario,
}

export const ALL_SCENARIOS = [
  expressHappyPathScenario,
  happyPathScenario,
  rejectThenPassScenario,
  injectionAttackScenario,
  captureDeclinedScenario,
  silentBuyerAutoreleaseScenario,
]
