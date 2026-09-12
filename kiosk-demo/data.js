/* Shared menu data for the touchless ordering kiosk demo. */
const MENU_DATA = {
  underground: {
    name: 'Underground Grill',
    tagline: 'Burgers & sandwiches, smashed fresh',
    image: 'images/underground-banner.jpg',
    open: true,
    ready: '9 min',
    items: [
      {
        id: 'smash-burger',
        name: 'Smash Burger',
        price: 14.15,
        desc: 'Potato bun, onion, cheddar, comeback sauce, pickle.',
        image: 'images/smash-burger.jpg',
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
        image: 'images/nashville-sandwich.jpg',
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
        image: 'images/veggie-melt.jpg',
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
        image: 'images/bacon-cheeseburger.jpg',
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
    name: 'Tandoor House',
    tagline: 'North Indian favorites, made to order',
    image: 'images/tandoor-banner.jpg',
    open: true,
    ready: '12 min',
    items: [
      {
        id: 'butter-chicken',
        name: 'Butter Chicken Bowl',
        price: 12.95,
        desc: 'Basmati rice, butter chicken, naan on the side.',
        image: 'images/butter-chicken.jpg',
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
        image: 'images/paneer-wrap.jpg',
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
        image: 'images/samosa-chaat.jpg',
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
        image: 'images/chicken-tikka-masala.jpg',
        sides: [
          { name: 'Extra Naan', add: 1.5 },
          { name: 'Basmati Rice', add: 0 },
          { name: 'No Side', add: 0 },
        ],
      },
    ],
  },
  greencart: {
    name: 'Bayou Seafood House',
    tagline: 'Fried seafood & Cajun classics',
    image: 'images/bayou-seafood.jpg',
    open: false,
    ready: null,
    items: [],
  },
};

function ttFindItem(restaurantId, itemId) {
  const r = MENU_DATA[restaurantId];
  if (!r) return null;
  return r.items.find((it) => it.id === itemId) || null;
}

function ttMoney(n) {
  return '$' + n.toFixed(2);
}
