import {isExploration} from './dogspot-care-demo.mjs?v=registered-care-20261127';

// Use the existing completion receipt and transport, once per booking.
// Include saved services so switching bookings cannot lose a finished demo's email.
export function demoCompletionReceipts(state, caregivers, createReceipt) {
  if (isExploration(state) || !state.user?.email) return [];
  const receipts = new Set((state.emailReceipts ?? []).map(receipt => receipt.id));
  return (state.bookings ?? []).filter(booking => {
    const service = booking.id === state.currentBookingId ? state : state.serviceSnapshots?.[booking.id];
    const demo = service?.careDemo;
    return booking.status === 'finalizado' && demo?.finished === true &&
      (demo.ownerId == null || demo.ownerId === state.user.id) &&
      (demo.bookingId == null || demo.bookingId === booking.id) &&
      !receipts.has(`completion:${booking.id}`);
  }).map(booking => {
    const pet = booking.petSnapshot ?? state.pets?.find(pet => pet.id === booking.petId);
    const caregiver = caregivers.find(caregiver => caregiver.id === booking.caregiverId);
    return createReceipt(state.user, booking, pet?.name ?? 'Tu mascota', caregiver?.name ?? 'Equipo DogSpot');
  }).filter(Boolean);
}
