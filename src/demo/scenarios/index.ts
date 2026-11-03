/**
 * Scenarios registry — registers all 5 Judge Mode scenarios.
 * Implements phase-7-agents-judge-mode-mcp.md §7.3.
 */
import { registerScenario } from '@/demo/runner'
import { happyPathScenario } from './happy_path'
import { rejectThenPassScenario } from './reject_then_pass'
import { injectionAttackScenario } from './injection_attack'
import { captureDeclinedScenario } from './capture_declined'
import { silentBuyerAutoreleaseScenario } from './silent_buyer_autorelease'

// Register all 5 scenarios
registerScenario(happyPathScenario)
registerScenario(rejectThenPassScenario)
registerScenario(injectionAttackScenario)
registerScenario(captureDeclinedScenario)
registerScenario(silentBuyerAutoreleaseScenario)

export {
  happyPathScenario,
  rejectThenPassScenario,
  injectionAttackScenario,
  captureDeclinedScenario,
  silentBuyerAutoreleaseScenario,
}

export const ALL_SCENARIOS = [
  happyPathScenario,
  rejectThenPassScenario,
  injectionAttackScenario,
  captureDeclinedScenario,
  silentBuyerAutoreleaseScenario,
]
