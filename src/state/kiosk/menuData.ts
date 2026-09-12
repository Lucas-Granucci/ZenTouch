import type { MenuItem, Restaurant, RestaurantId } from './types'

export const MENU_DATA: Readonly<Record<RestaurantId, Restaurant>> = {
  underground: {
    id: 'underground',
    name: 'Underground Grill',
    tagline: 'Burgers & sandwiches, smashed fresh',
    image: '/kiosk/underground-banner.jpg',
    open: true,
    ready: '9 min',
    items: [
      {
        id: 'smash-burger',
        name: 'Smash Burger',
        price: 14.15,
        desc: 'Potato bun, onion, cheddar, comeback sauce, pickle.',
        image: '/kiosk/smash-burger.jpg',
        sides: [
          { name: 'Sweet Potato Fries', add: 1.0 },
          { name: 'Cajun Fries', add: 0 },
          { name: 'Curly Fries', add: 0 },
          { name: 'Side Salad', add: 0.5 },
        ],
      },
      {
        id: 'nashville-sandwich',
        name: 'Nashville Sandwich',
        price: 13.5,
        desc: 'Crispy chicken, hot honey, slaw, pickle.',
        image: '/kiosk/nashville-sandwich.jpg',
        sides: [
          { name: 'Cajun Fries', add: 0 },
          { name: 'Curly Fries', add: 0 },
          { name: 'Side Salad', add: 0.5 },
        ],
      },
      {
        id: 'veggie-melt',
        name: 'Veggie Melt',
        price: 12.25,
        desc: 'Grilled vegetables, provolone, garlic aioli.',
        image: '/kiosk/veggie-melt.jpg',
        sides: [
          { name: 'Sweet Potato Fries', add: 1.0 },
          { name: 'Cajun Fries', add: 0 },
          { name: 'Side Salad', add: 0.5 },
        ],
      },
      {
        id: 'bacon-cheeseburger',
        name: 'Bacon Cheeseburger',
        price: 13.75,
        desc: 'Double patty, cheddar, applewood bacon, brioche bun.',
        image: '/kiosk/bacon-cheeseburger.jpg',
        sides: [
          { name: 'Sweet Potato Fries', add: 1.0 },
          { name: 'Cajun Fries', add: 0 },
          { name: 'Curly Fries', add: 0 },
          { name: 'Side Salad', add: 0.5 },
        ],
      },
    ],
  },
  tandoor: {
    id: 'tandoor',
    name: 'Tandoor House',
    tagline: 'North Indian favorites, made to order',
    image: '/kiosk/tandoor-banner.jpg',
    open: true,
    ready: '12 min',
    items: [
      {
        id: 'butter-chicken',
        name: 'Butter Chicken Bowl',
        price: 12.95,
        desc: 'Basmati rice, butter chicken, naan on the side.',
        image: '/kiosk/butter-chicken.jpg',
        sides: [
          { name: 'Extra Naan', add: 1.5 },
          { name: 'Raita', add: 0.75 },
          { name: 'No Side', add: 0 },
        ],
      },
      {
        id: 'paneer-wrap',
        name: 'Paneer Tikka Wrap',
        price: 10.5,
        desc: 'Grilled paneer, mint chutney, pickled onion.',
        image: '/kiosk/paneer-wrap.jpg',
        sides: [
          { name: 'Chips', add: 0 },
          { name: 'Side Salad', add: 0.5 },
          { name: 'No Side', add: 0 },
        ],
      },
      {
        id: 'samosa-chaat',
        name: 'Samosa Chaat',
        price: 7.25,
        desc: 'Crushed samosa, chickpeas, yogurt, tamarind.',
        image: '/kiosk/samosa-chaat.jpg',
        sides: [
          { name: 'Extra Chutney', add: 0.5 },
          { name: 'No Side', add: 0 },
        ],
      },
      {
        id: 'chicken-tikka-masala',
        name: 'Chicken Tikka Masala',
        price: 13.25,
        desc: 'Tandoor-charred chicken in a creamy tomato curry, with naan.',
        image: '/kiosk/chicken-tikka-masala.jpg',
        sides: [
          { name: 'Extra Naan', add: 1.5 },
          { name: 'Basmati Rice', add: 0 },
          { name: 'No Side', add: 0 },
        ],
      },
    ],
  },
  greencart: {
    id: 'greencart',
    name: 'Bayou Seafood House',
    tagline: 'Fried seafood & Cajun classics',
    image: '/kiosk/bayou-seafood.jpg',
    open: false,
    ready: null,
    items: [],
  },
}

export function findItem(restaurantId: RestaurantId, itemId: string): MenuItem | null {
  return MENU_DATA[restaurantId]?.items.find((item) => item.id === itemId) ?? null
}

export function formatMoney(amount: number): string {
  return `$${amount.toFixed(2)}`
}
