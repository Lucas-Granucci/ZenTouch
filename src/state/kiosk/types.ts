export type RestaurantId = 'underground' | 'tandoor' | 'greencart'
export type ItemId = string

export interface Side {
  readonly name: string
  readonly add: number
}

export interface MenuItem {
  readonly id: ItemId
  readonly name: string
  readonly price: number
  readonly desc: string
  readonly image: string
  readonly sides: readonly Side[]
}

export interface Restaurant {
  readonly id: RestaurantId
  readonly name: string
  readonly tagline: string
  readonly image: string
  readonly open: boolean
  readonly ready: string | null
  readonly items: readonly MenuItem[]
}

export interface CartLine {
  readonly restaurantId: RestaurantId
  readonly itemId: ItemId
  readonly sideName: string
  readonly quantity: number
  readonly unitPrice: number
}

export type Screen = 'welcome' | 'restaurants' | 'menu' | 'item' | 'cart' | 'confirmation'

export interface Confirmation {
  readonly orderNumber: string
  readonly peopleAhead: number
  readonly restaurantName: string
  readonly readyTime: string
}

export interface KioskState {
  readonly screen: Screen
  readonly currentRestaurantId: RestaurantId | null
  readonly currentItemId: ItemId | null
  readonly selectedSideName: string | null
  readonly quantity: number
  readonly cart: readonly CartLine[]
  readonly confirmation: Confirmation | null
}

export type KioskAction =
  | { readonly type: 'NAVIGATE_WELCOME' }
  | { readonly type: 'NAVIGATE_RESTAURANTS' }
  | { readonly type: 'OPEN_RESTAURANT'; readonly restaurantId: RestaurantId }
  | { readonly type: 'OPEN_ITEM'; readonly restaurantId: RestaurantId; readonly itemId: ItemId }
  | { readonly type: 'BACK_TO_MENU' }
  | { readonly type: 'BACK_TO_RESTAURANTS' }
  | { readonly type: 'SELECT_SIDE'; readonly sideName: string }
  | { readonly type: 'SET_QUANTITY'; readonly quantity: number }
  | { readonly type: 'ADD_TO_CART' }
  | { readonly type: 'GO_TO_CART' }
  | { readonly type: 'PLACE_ORDER' }
  | { readonly type: 'RESET' }
