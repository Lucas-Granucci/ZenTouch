import './fixtures/kiosk/register.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SimulatedInputProvider } from '../src/interaction/simulated/SimulatedInputProvider.ts'
const { kioskReducer, initialKioskState } = await import('../src/state/kiosk/reducer.ts')
import type { KioskAction } from '../src/state/kiosk/types.ts'

test('simulated dwell completes customization, cart, confirmation and a fresh order', () => {
  let time = 0
  let state = initialKioskState
  const provider = new SimulatedInputProvider({ now: () => time, lockDurationMs: 100, dwellDurationMs: 200, cooldownDurationMs: 300 })
  const seen = new Set<string>()
  let action: KioskAction
  provider.subscribeEvents((event) => {
    if (event.type !== 'select') return
    assert.ok(!seen.has(event.id))
    seen.add(event.id)
    state = kioskReducer(state, action)
  })
  function choose(id: string, nextAction: KioskAction) {
    action = nextAction
    const remove = provider.targets.register({ id, enabled: true, rect: { x: 20, y: 20, width: 100, height: 60 } })
    provider.pointAt(id)
    time += 100; provider.tick(time)
    assert.equal(provider.getSnapshot().state.phase, 'LOCKED')
    time += 200; provider.tick(time)
    assert.equal(provider.getSnapshot().state.phase, 'COOLDOWN')
    remove()
    assert.equal(provider.targets.getSnapshot().length, 0)
    time += 300; provider.tick(time)
  }
  choose('welcome-begin', { type: 'NAVIGATE_RESTAURANTS' })
  assert.equal(state.screen, 'restaurants')
  choose('restaurant-underground', { type: 'OPEN_RESTAURANT', restaurantId: 'underground' })
  assert.equal(state.screen, 'menu')
  choose('menu-item-smash-burger', { type: 'OPEN_ITEM', restaurantId: 'underground', itemId: 'smash-burger' })
  assert.equal(state.screen, 'item')
  assert.equal(kioskReducer(state, { type: 'ADD_TO_CART' }), state)
  choose('side-Sweet Potato Fries', { type: 'SELECT_SIDE', sideName: 'Sweet Potato Fries' })
  choose('item-qty-inc', { type: 'SET_QUANTITY', quantity: state.quantity + 1 })
  choose('add-to-cart', { type: 'ADD_TO_CART' })
  assert.equal(state.screen, 'cart')
  assert.equal(state.cart.length, 1)
  assert.equal(state.cart[0].unitPrice * state.cart[0].quantity, 30.3)
  choose('cart-back', { type: 'BACK_TO_MENU' })
  assert.equal(state.cart.length, 1)
  choose('menu-item-smash-burger', { type: 'OPEN_ITEM', restaurantId: 'underground', itemId: 'smash-burger' })
  choose('side-Cajun Fries', { type: 'SELECT_SIDE', sideName: 'Cajun Fries' })
  choose('add-to-cart', { type: 'ADD_TO_CART' })
  assert.equal(state.cart.length, 2)
  choose('place-order', { type: 'PLACE_ORDER' })
  assert.equal(state.screen, 'confirmation')
  assert.equal(state.confirmation?.restaurantName, 'Underground Grill')
  assert.deepEqual(state.cart, [])
  choose('done', { type: 'NAVIGATE_WELCOME' })
  assert.deepEqual(state, initialKioskState)
  assert.equal(seen.size, 12)
  provider.dispose()
})

test('disabled targets and lost input cannot order; recovery starts a fresh hold', () => {
  let time = 0
  const provider = new SimulatedInputProvider({ now: () => time, lockDurationMs: 100, dwellDurationMs: 200 })
  const rect = { x: 0, y: 0, width: 100, height: 100 }
  provider.targets.register({ id: 'closed', enabled: false, rect })
  assert.throws(() => provider.pointAt('closed'), /Ineligible/)
  provider.targets.register({ id: 'add-to-cart', enabled: true, rect })
  let selections = 0
  provider.subscribeEvents((event) => { if (event.type === 'select') selections++ })
  provider.pointAt('add-to-cart')
  time = 100; provider.tick(time)
  provider.pointAt(null)
  time = 10000; provider.tick(time)
  assert.equal(selections, 0)
  provider.pointAt('add-to-cart')
  assert.equal(provider.getSnapshot().state.phase, 'POINTING')
  time += 100; provider.tick(time)
  time += 200; provider.tick(time)
  assert.equal(selections, 1)
  time += 100; provider.tick(time)
  assert.equal(selections, 1)
  provider.dispose()
})
