const accountEmail = user => typeof user?.email === 'string' ? user.email.trim().toLowerCase() : '';
const personalAccount = user => !!accountEmail(user) && accountEmail(user) !== 'usuario@dogspot.pe';

const object = value => value && typeof value === 'object' && !Array.isArray(value);
const snapshot = state => {
  const {localAccounts, ...saved} = state;
  return {...saved, screen: 'splash'};
};

function archivedAccounts(current) {
  return Object.fromEntries(Object.entries(object(current?.localAccounts) ? current.localAccounts : {})
    .filter(([email, state]) => object(state) && personalAccount(state.user) && email === accountEmail(state.user))
    .map(([email, state]) => [email, snapshot(state)]));
}

// The active profile and the other profiles share one existing storage entry.
// Never nest the archive in a profile or duplicate the active profile in it.
export function localAccount(current, email) {
  const key = accountEmail({email});
  if (personalAccount(current?.user) && accountEmail(current.user) === key) return current;
  return archivedAccounts(current)[key] ?? null;
}

export function accountBase(current, user, defaults, restore = value => value) {
  const key = accountEmail(user), stored = localAccount(current, key);
  const localAccounts = archivedAccounts(current);
  if (personalAccount(current?.user) && accountEmail(current.user) !== key) {
    localAccounts[accountEmail(current.user)] = snapshot(current);
  }
  delete localAccounts[key];
  const fresh = {...defaults, user: null, authCredential: null, pets: [], selectedPetId: '',
    bookings: [], currentBookingId: null, serviceSnapshots: {}, draft: null, tasks: [],
    messages: [], notifications: [], emailReceipts: [], registrationEmailId: null,
    assistantMessages: null, careDemo: null, editingPetId: null, returnTo: null,
    active: {status: 'confirmado', rated: false},
    reviews: (Array.isArray(defaults.reviews) ? defaults.reviews : []).filter(review => review.source !== 'session')};
  return {...fresh, ...(stored ? restore(snapshot(stored)) : {}), localAccounts};
}

export function saveAccountTransition(state, storage, key) {
  try {
    storage.setItem(key, JSON.stringify({...state, screen: 'splash',
      serviceSnapshots: Object.fromEntries(Object.entries(state.serviceSnapshots ?? {})
        .filter(([id]) => id !== (state.currentBookingId ?? 'demo-service')))}));
  } catch {
    throw new Error('No se pudo guardar el cambio de cuenta en este navegador. La cuenta anterior se conserva. Revisa el espacio disponible y vuelve a intentarlo.');
  }
}

export function receiptResultForAccount(current, receipt, result) {
  const owner = accountEmail({email: receipt.to});
  const update = state => ({...state, emailReceipts: (state.emailReceipts ?? []).map(saved =>
    saved.id === receipt.id && accountEmail({email: saved.to}) === owner
      ? {...saved, ...result, completedAt: new Date().toISOString()} : saved)});
  if (accountEmail(current.user) === owner) return update(current);
  const localAccounts = archivedAccounts(current);
  if (!localAccounts[owner]) return current;
  localAccounts[owner] = update(localAccounts[owner]);
  return {...current, localAccounts};
}

// Remove only the untouched built-in reference. A registered pet named Luna,
// an edited reference or a pet with a booking must always be preserved.
export function withoutReferencePet(pets, reference, bookings = []) {
  return (Array.isArray(pets) ? pets : []).filter(pet => {
    if (!pet || !reference || pet.id !== reference.id || bookings.some(booking => booking.petId === pet.id)) return true;
    const keys = Object.keys(pet);
    return keys.length !== Object.keys(reference).length || keys.some(key => pet[key] !== reference[key]);
  });
}

export function registrationState(current, user, reference) {
  const previous = localAccount(current, accountEmail(user));
  if (previous?.authCredential) {
    throw new Error('Este correo ya está registrado en este navegador. Inicia sesión con tu contraseña.');
  }
  const pets = previous ? withoutReferencePet(previous.pets, reference, previous.bookings) : [];
  if (previous) return {pets, selectedPetId: pets.some(pet => pet.id === previous.selectedPetId) ? previous.selectedPetId : pets[0]?.id ?? ''};
  return {pets: [], selectedPetId: '', editingPetId: null, returnTo: 'home', bookings: [], currentBookingId: null,
    serviceSnapshots: {}, draft: null, tasks: [], messages: [], notifications: [], active: {status: 'confirmado', rated: false}};
}

export function migrateRegisteredPets(state, reference) {
  if (!personalAccount(state.user) || !Array.isArray(state.pets)) return state;
  const pets = withoutReferencePet(state.pets, reference, state.bookings);
  if (pets.length === state.pets.length) return state;
  return {...state, pets, selectedPetId: pets.some(pet => pet.id === state.selectedPetId) ? state.selectedPetId : pets[0]?.id ?? ''};
}
