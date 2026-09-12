import { MENU_DATA, findItem } from './menuData'
import type { KioskAction, KioskState } from './types'

export const initialKioskState: KioskState = {
  screen: 'welcome',
  currentRestaurantId: null,
  currentItemId: null,
  selectedSideName: null,
  quantity: 1,
  cart: [],
  confirmation: null,
}

export function kioskReducer(state: KioskState, action: KioskAction): KioskState {
  switch (action.type) {
    case 'NAVIGATE_WELCOME':
      return { ...initialKioskState }

    case 'NAVIGATE_RESTAURANTS':
      return { ...state, screen: 'restaurants' }

    case 'OPEN_RESTAURANT':
      return { ...state, screen: 'menu', currentRestaurantId: action.restaurantId }

    case 'OPEN_ITEM':
      return {
        ...state,
        screen: 'item',
        currentRestaurantId: action.restaurantId,
        currentItemId: action.itemId,
        selectedSideName: null,
        quantity: 1,
      }

    case 'BACK_TO_MENU':
      return { ...state, screen: 'menu' }

    case 'BACK_TO_RESTAURANTS':
      return { ...state, screen: 'restaurants' }

    case 'SELECT_SIDE':
      return { ...state, selectedSideName: action.sideName }

    case 'SET_QUANTITY':
      return { ...state, quantity: Math.max(1, action.quantity) }

    case 'ADD_TO_CART': {
      const { currentRestaurantId, currentItemId, selectedSideName } = state
      if (!currentRestaurantId || !currentItemId || !selectedSideName) return state
      const item = findItem(currentRestaurantId, currentItemId)
      const side = item?.sides.find((candidate) => candidate.name === selectedSideName)
      if (!item || !side) return state
      return {
        ...state,
        screen: 'cart',
        cart: [
          ...state.cart,
          {
            restaurantId: currentRestaurantId,
            itemId: currentItemId,
            sideName: selectedSideName,
            quantity: state.quantity,
            unitPrice: item.price + side.add,
          },
        ],
      }
    }

    case 'GO_TO_CART':
      return { ...state, screen: 'cart' }

    case 'PLACE_ORDER': {
      const restaurantId = state.cart[0]?.restaurantId ?? state.currentRestaurantId
      if (!restaurantId) return state
      const restaurant = MENU_DATA[restaurantId]
      return {
        ...state,
        screen: 'confirmation',
        cart: [],
        confirmation: { restaurantName: restaurant.name, readyTime: restaurant.ready ?? 'a few minutes' },
      }
    }

    case 'RESET':
      return { ...initialKioskState }

    default:
      return state
  }
}
