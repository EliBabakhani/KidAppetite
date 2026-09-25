/* KidAppetite demo seed data.
   Everything here is sample content for the prototype. In production this
   lives in a database (see README, "Road to production"). */
'use strict';

function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function todayISO() { return isoDate(new Date()); }

const NEIGHBOURHOODS = ['Riverside', 'Maple Heights', 'Harbour View', 'Oakridge Park', 'Cedar Grove'];

const SPECIALTIES = {
  solids: 'Starting solids',
  picky: 'Picky eating',
  sensory: 'Autism and sensory feeding',
  diabetes: 'Diabetes',
  allergies: 'Food allergies',
  celiac: 'Celiac and gluten free',
  constipation: 'Constipation and gut health',
  reflux: 'Reflux'
};

/* Conditions parents can tick on the recipe form.
   exclude: allergens that must never appear. prefer: recipe tags ranked first. */
const CONDITIONS = [
  { id: 'sensory', label: 'Autism or sensory sensitivities', prefer: ['sensoryFriendly'],
    note: 'Recipes marked "Predictable texture" keep colour and texture the same every time and can be served with foods kept separate. Offer one new food at a time, next to a food your child already trusts.' },
  { id: 'diabetes', label: 'Type 1 diabetes', prefer: ['lowSugar'],
    note: 'Recipes with no added sugar are ranked first. Carb counts and insulin timing should always come from your child\'s diabetes care team.' },
  { id: 'celiac', label: 'Celiac disease', exclude: ['gluten'],
    note: 'Recipes containing gluten are hidden. Check that oats, stock and sauces are certified gluten free.' },
  { id: 'constipation', label: 'Constipation', prefer: ['highFiber'],
    note: 'High fibre recipes are ranked first. Offer water with meals once your child is over 6 months.' },
  { id: 'reflux', label: 'Reflux or frequent spit up', prefer: ['gentle'],
    note: 'Gentle, smooth recipes are ranked first. Smaller portions more often can help.' },
  { id: 'picky', label: 'Picky eating', prefer: ['hiddenVeg', 'sensoryFriendly'],
    note: 'Hidden veg recipes are ranked first. Keep portions small and let your child serve themselves when they can.' }
];

const ALLERGENS = ['gluten', 'dairy', 'egg', 'nuts', 'fish', 'soy', 'sesame'];

const TAG_LABELS = {
  ironRich: 'Iron rich',
  highFiber: 'High fibre',
  gentle: 'Gentle on tummies',
  sensoryFriendly: 'Predictable texture',
  lowSugar: 'No added sugar',
  hiddenVeg: 'Hidden veg'
};

const RECIPES = [
  { id: 'r1', name: 'Sweet potato and red lentil mash', emoji: '🍠', minMonths: 6, maxMonths: 36, texture: 'Smooth mash', time: 25,
    allergens: [], tags: ['ironRich', 'highFiber', 'gentle', 'sensoryFriendly'],
    ingredients: ['1 small sweet potato, peeled and cubed', '3 tbsp red lentils, rinsed', '1 cup water', 'Pinch of cumin (optional)'],
    steps: ['Simmer the sweet potato and lentils in the water for about 20 minutes, until very soft.', 'Blend or mash with a little cooking water until smooth.', 'Add the cumin for babies who are ready for new flavours.'],
    why: 'Lentils add plant iron and protein, and sweet potato keeps it naturally sweet.' },
  { id: 'r2', name: 'Pear, oat and prune porridge', emoji: '🍐', minMonths: 6, maxMonths: 48, texture: 'Soft porridge', time: 10,
    allergens: ['gluten'], tags: ['highFiber', 'gentle'],
    ingredients: ['3 tbsp rolled oats', '1/2 ripe pear, grated', '2 prunes, finely chopped', '3/4 cup water or your child\'s usual milk'],
    steps: ['Simmer the oats and liquid for 5 minutes, stirring.', 'Stir in the pear and prunes and cook 2 more minutes.', 'Cool and thin with a little milk if needed.'],
    why: 'Oats, pear and prunes work together to keep digestion regular.' },
  { id: 'r3', name: 'Chicken and vegetable congee', emoji: '🍚', minMonths: 7, maxMonths: 60, texture: 'Soft and silky', time: 45,
    allergens: [], tags: ['gentle', 'lowSugar', 'ironRich'],
    ingredients: ['1/4 cup white rice', '3 cups low sodium stock or water', '1 small boneless chicken thigh', '1 small carrot, finely diced', 'Handful of spinach'],
    steps: ['Simmer the rice, stock and whole chicken thigh for 35 minutes, stirring now and then.', 'Remove the chicken, shred it finely and return it to the pot with the carrot.', 'Cook 8 more minutes, stir in the spinach, and blend for younger babies.'],
    why: 'Warm, soothing and easy to digest, with iron from the dark chicken meat.' },
  { id: 'r4', name: 'Butternut squash and apple purée', emoji: '🎃', minMonths: 6, maxMonths: 18, texture: 'Smooth purée', time: 30,
    allergens: [], tags: ['gentle', 'sensoryFriendly'],
    ingredients: ['2 cups butternut squash, cubed', '1 apple, peeled and chopped', 'Water for steaming'],
    steps: ['Steam the squash and apple for 15 to 20 minutes until soft.', 'Blend until completely smooth.', 'Freeze extra portions in an ice cube tray.'],
    why: 'A mild first food with a consistent texture that babies accept easily.' },
  { id: 'r5', name: 'Chickpea and carrot patties', emoji: '🥕', minMonths: 9, maxMonths: 72, texture: 'Soft finger food', time: 25,
    allergens: [], tags: ['highFiber', 'lowSugar', 'ironRich', 'hiddenVeg'],
    ingredients: ['1 can chickpeas, drained', '1 carrot, finely grated', '3 tbsp chickpea flour', '1 tbsp olive oil', 'Pinch of paprika'],
    steps: ['Mash the chickpeas, then mix in the carrot, flour and paprika.', 'Shape into small patties a toddler can hold.', 'Pan fry in the oil for 3 minutes each side until golden.'],
    why: 'Naturally gluten free, full of fibre, and easy for small hands.' },
  { id: 'r6', name: 'Turkey and zucchini meatballs', emoji: '🧆', minMonths: 10, maxMonths: 72, texture: 'Soft bites', time: 30,
    allergens: ['egg'], tags: ['ironRich', 'lowSugar', 'hiddenVeg'],
    ingredients: ['250 g ground turkey', '1 small zucchini, grated and squeezed dry', '1 egg', '1/2 tsp dried oregano'],
    steps: ['Heat the oven to 200°C.', 'Mix everything together and roll into small balls.', 'Bake on a lined tray for 15 to 18 minutes until cooked through.'],
    why: 'Iron and protein with a vegetable most kids never notice.' },
  { id: 'r7', name: 'Salmon and pea fishcakes', emoji: '🐟', minMonths: 10, maxMonths: 72, texture: 'Soft finger food', time: 35,
    allergens: ['fish', 'egg'], tags: ['lowSugar'],
    ingredients: ['1 cooked salmon fillet, boneless', '1 cup mashed potato', '1/2 cup peas, cooked and mashed', '1 egg yolk'],
    steps: ['Flake the salmon and check carefully for bones.', 'Mix with the potato, peas and egg yolk and shape into small cakes.', 'Pan fry in a little oil for 3 minutes each side.'],
    why: 'Omega 3 fats from salmon support brain development.' },
  { id: 'r8', name: 'Broccoli and cheddar mini muffins', emoji: '🥦', minMonths: 12, maxMonths: 72, texture: 'Soft baked', time: 30,
    allergens: ['gluten', 'dairy', 'egg'], tags: ['hiddenVeg'],
    ingredients: ['1 cup flour', '1 tsp baking powder', '1 cup broccoli, steamed and finely chopped', '1/2 cup grated cheddar', '1 egg', '1/2 cup milk'],
    steps: ['Heat the oven to 180°C and grease a mini muffin tin.', 'Mix the dry ingredients, then stir in everything else.', 'Bake for 15 minutes until springy.'],
    why: 'A savoury snack that turns broccoli into something kids ask for.' },
  { id: 'r9', name: 'Roasted veggie sticks, served separately', emoji: '🥒', minMonths: 12, maxMonths: 72, texture: 'Firm outside, soft inside', time: 30,
    allergens: [], tags: ['sensoryFriendly', 'lowSugar', 'highFiber'],
    ingredients: ['1 carrot', '1 parsnip', '1 zucchini', '1 tbsp olive oil'],
    steps: ['Heat the oven to 200°C.', 'Cut every vegetable into sticks of the same size and shape.', 'Roast for 20 minutes and serve each vegetable in its own section of the plate.'],
    why: 'Same shape, same place on the plate, every time. Predictable food feels safe.' },
  { id: 'r10', name: 'Greek yogurt with berry swirl', emoji: '🫐', minMonths: 9, maxMonths: 72, texture: 'Creamy', time: 5,
    allergens: ['dairy'], tags: ['lowSugar', 'gentle'],
    ingredients: ['1/2 cup plain full fat Greek yogurt', '1/4 cup blueberries, mashed'],
    steps: ['Spoon the yogurt into a bowl.', 'Swirl the mashed berries through it.'],
    why: 'Protein and calcium with fruit as the only sweetness.' },
  { id: 'r11', name: 'Tofu, rice and veggie bowl', emoji: '🥢', minMonths: 12, maxMonths: 72, texture: 'Soft pieces', time: 20,
    allergens: ['soy', 'sesame'], tags: ['lowSugar', 'ironRich'],
    ingredients: ['100 g firm tofu, cubed', '1/2 cup cooked rice', '1/2 cup mixed vegetables', '1 tsp low sodium soy sauce', 'A few drops of sesame oil'],
    steps: ['Pan fry the tofu until lightly golden.', 'Add the vegetables and cook until soft.', 'Serve over rice with the soy sauce and sesame oil.'],
    why: 'Plant protein and iron in a bowl toddlers can pick through.' },
  { id: 'r12', name: 'Hidden veg tomato pasta', emoji: '🍝', minMonths: 12, maxMonths: 72, texture: 'Smooth sauce', time: 25,
    allergens: ['gluten'], tags: ['hiddenVeg', 'sensoryFriendly'],
    ingredients: ['1 cup small pasta shapes', '1 can crushed tomatoes', '1 small carrot, 1/2 red pepper and 1/2 zucchini, chopped', '1 tbsp olive oil'],
    steps: ['Soften the vegetables in the oil for 8 minutes.', 'Add the tomatoes, simmer 10 minutes, then blend until completely smooth.', 'Stir through the cooked pasta.'],
    why: 'Three vegetables in a sauce that looks exactly like plain tomato.' },
  { id: 'r13', name: 'Spinach and banana oat pancakes', emoji: '🥞', minMonths: 10, maxMonths: 72, texture: 'Soft and fluffy', time: 15,
    allergens: ['egg', 'gluten'], tags: ['hiddenVeg', 'ironRich'],
    ingredients: ['1 ripe banana', '1 egg', '1/2 cup oats', 'Handful of spinach'],
    steps: ['Blend everything until smooth.', 'Cook small spoonfuls in a lightly oiled pan for 2 minutes each side.'],
    why: 'Green "dinosaur pancakes" sweetened only by banana.' },
  { id: 'r14', name: 'Avocado and egg toast fingers', emoji: '🥑', minMonths: 8, maxMonths: 60, texture: 'Soft finger food', time: 10,
    allergens: ['egg', 'gluten'], tags: ['lowSugar'],
    ingredients: ['1 slice wholegrain bread', '1/4 ripe avocado', '1 egg, hard boiled'],
    steps: ['Toast the bread lightly and cut into fingers.', 'Spread with mashed avocado.', 'Top with finely chopped egg.'],
    why: 'Healthy fats and protein in a shape babies can hold on their own.' }
];

function nextWorkday(days, fromOffset = 1) {
  const d = new Date();
  for (let i = fromOffset; i < fromOffset + 14; i++) {
    const c = new Date(d); c.setDate(d.getDate() + i);
    if (days.includes(c.getDay())) return isoDate(c);
  }
  return isoDate(d);
}

function buildSeed() {
  const today = todayISO();
  const users = [
    { id: 'u-admin', role: 'admin', name: 'KidAppetite Team', email: 'admin@kidappetite.demo' },

    { id: 'u-parent-sara', role: 'parent', name: 'Sara Moradi', email: 'sara@kidappetite.demo', neighbourhood: 'Riverside',
      children: [{ id: 'c-arya', name: 'Arya', ageMonths: 18, ageRecordedOn: today, weight: 10.8, height: 81, conditions: ['picky'], allergies: [] }] },

    { id: 'u-mom-lena', role: 'mother', name: 'Lena Park', email: 'lena@kidappetite.demo', neighbourhood: 'Riverside', cookStatus: 'approved',
      cookApplication: { foodSafe: true, kitchen: 'Home kitchen, separate prep area, no pets.', dishes: 'Congee, purées, soft rice dishes' },
      children: [{ id: 'c-mina', name: 'Mina', ageMonths: 16, ageRecordedOn: today, conditions: [], allergies: [] }] },
    { id: 'u-mom-amira', role: 'mother', name: 'Amira Haddad', email: 'amira@kidappetite.demo', neighbourhood: 'Maple Heights', cookStatus: 'approved',
      cookApplication: { foodSafe: true, kitchen: 'Home kitchen with a dedicated nut free zone.', dishes: 'Soft kofta, lentil soups, muffins' },
      children: [{ id: 'c-yusuf', name: 'Yusuf', ageMonths: 30, ageRecordedOn: today, conditions: [], allergies: [] }] },
    { id: 'u-mom-jun', role: 'mother', name: 'Jun Tanaka', email: 'jun@kidappetite.demo', neighbourhood: 'Harbour View', cookStatus: 'approved',
      cookApplication: { foodSafe: true, kitchen: 'Home kitchen, allergen labels on every container.', dishes: 'Onigiri, miso soups, veggie bowls' },
      children: [{ id: 'c-hana', name: 'Hana', ageMonths: 26, ageRecordedOn: today, conditions: [], allergies: [] }] },
    { id: 'u-mom-carla', role: 'mother', name: 'Carla Mendes', email: 'carla@kidappetite.demo', neighbourhood: 'Oakridge Park', cookStatus: 'pending',
      cookApplication: { foodSafe: true, kitchen: 'Home kitchen, no pets, stainless prep surfaces.', dishes: 'Black bean soup, soft arepas', submittedAt: Date.now() },
      children: [{ id: 'c-leo', name: 'Leo', ageMonths: 14, ageRecordedOn: today, conditions: [], allergies: [] }] },

    { id: 'u-con-nadia', role: 'consultant', name: 'Dr. Nadia Rahimi', email: 'nadia@kidappetite.demo', neighbourhood: 'Harbour View',
      title: 'Pediatric dietitian, RD', specialties: ['diabetes', 'allergies', 'solids'], modes: ['online', 'in-person'],
      location: 'Harbour View Family Clinic', fee: 95, status: 'approved', credentials: 'Registered Dietitian, pediatric specialty',
      bio: 'Twelve years helping families of children with type 1 diabetes and food allergies build meals the whole table can share.',
      availability: { days: [1, 2, 4], hours: ['09:00', '10:00', '11:00', '14:00', '15:00'] } },
    { id: 'u-con-marcus', role: 'consultant', name: 'Marcus Oyelaran', email: 'marcus@kidappetite.demo', neighbourhood: 'Cedar Grove',
      title: 'Feeding specialist, autism and sensory needs', specialties: ['sensory', 'picky'], modes: ['online'],
      location: 'Online', fee: 110, status: 'approved', credentials: 'MSc Nutrition, sensory feeding certification',
      bio: 'Works with autistic children and kids with sensory feeding challenges, using gentle food exposure with no pressure.',
      availability: { days: [2, 3, 5], hours: ['10:00', '11:00', '13:00', '16:00', '17:00'] } },
    { id: 'u-con-sofia', role: 'consultant', name: 'Sofia Duarte', email: 'sofia@kidappetite.demo', neighbourhood: 'Maple Heights',
      title: 'Infant feeding consultant', specialties: ['solids', 'reflux'], modes: ['in-person'],
      location: 'Maple Heights Community Centre', fee: 80, status: 'approved', credentials: 'Certified infant feeding consultant',
      bio: 'Supports parents through starting solids, reflux and the whole first year of eating.',
      availability: { days: [1, 3, 5, 6], hours: ['09:30', '10:30', '13:00', '14:00'] } },
    { id: 'u-con-priya', role: 'consultant', name: 'Priya Nair', email: 'priya@kidappetite.demo', neighbourhood: 'Riverside',
      title: 'Pediatric dietitian, RD', specialties: ['constipation', 'celiac', 'allergies'], modes: ['online', 'in-person'],
      location: 'Riverside Health Hub', fee: 100, status: 'approved', credentials: 'Registered Dietitian',
      bio: 'Focuses on gut health, celiac disease and building fibre into meals kids already like.',
      availability: { days: [2, 4, 6], hours: ['09:00', '11:00', '13:00', '15:00'] } },
    { id: 'u-con-tomas', role: 'consultant', name: 'Tomás Weber', email: 'tomas@kidappetite.demo', neighbourhood: 'Oakridge Park',
      title: 'Pediatric occupational therapist, feeding', specialties: ['picky', 'sensory'], modes: ['online'],
      location: 'Online', fee: 90, status: 'approved', credentials: 'Registered Occupational Therapist',
      bio: 'Helps picky eaters widen their plate one small, playful step at a time.',
      availability: { days: [1, 2, 3, 4], hours: ['15:00', '16:00', '17:00', '18:00'] } }
  ];

  const meals = [
    { id: 'm1', cookId: 'u-mom-lena', title: 'Chicken and veggie congee', description: 'Silky rice porridge with shredded chicken, carrot and spinach. Low salt.',
      ageMin: 8, ageMax: 36, portions: 6, price: 7, allergens: [], pickup: '5:00 to 6:30 pm' },
    { id: 'm2', cookId: 'u-mom-lena', title: 'Butternut and apple purée pots', description: 'Four 120 ml pots, steamed and blended smooth. Freezer friendly.',
      ageMin: 6, ageMax: 18, portions: 8, price: 5, allergens: [], pickup: '5:00 to 6:30 pm' },
    { id: 'm3', cookId: 'u-mom-amira', title: 'Soft lentil kofta with yogurt dip', description: 'Baked lentil and spinach kofta, soft enough for new chewers.',
      ageMin: 12, ageMax: 60, portions: 5, price: 8, allergens: ['dairy'], pickup: '4:30 to 6:00 pm' },
    { id: 'm4', cookId: 'u-mom-amira', title: 'Carrot oat mini muffins', description: 'A box of ten, sweetened with banana only.',
      ageMin: 12, ageMax: 72, portions: 10, price: 4, allergens: ['gluten', 'egg'], pickup: '4:30 to 6:00 pm' },
    { id: 'm5', cookId: 'u-mom-jun', title: 'Salmon onigiri with cucumber sticks', description: 'Two small rice balls with flaked salmon, deboned twice.',
      ageMin: 18, ageMax: 72, portions: 6, price: 9, allergens: ['fish', 'sesame'], pickup: '5:30 to 7:00 pm' }
  ].map((m) => ({ ...m, date: today, portionsLeft: m.portions, demo: true }));

  const bookings = [
    { id: 'b1', consultantId: 'u-con-nadia', parentId: 'u-parent-sara', childId: 'c-arya', date: nextWorkday([1, 2, 4]), time: '10:00',
      mode: 'online', note: 'Arya only eats beige food lately. How do I add vegetables without a fight?', status: 'booked', createdAt: Date.now() }
  ];

  return { version: 1, sessionUserId: null, users, meals, bookings, orders: [] };
}
