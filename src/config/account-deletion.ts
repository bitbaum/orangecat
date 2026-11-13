/**
 * What Delete Account does, said once. The Danger Zone, the confirm dialog and
 * /api/delete-user all read it here, so the promise and the act cannot drift.
 *
 * Each sentence is made true by delete_account() (migration 20261112203000):
 * the person's pages go; a record they share with someone else stays with that
 * person, with the reference to them set NULL; a group's pages stay with the
 * group; a founder hands the group on; an order still shipping to them blocks.
 */
export const ACCOUNT_DELETION_COPY = {
  whatHappens:
    'Deleting your account permanently removes your profile, every page you own (projects, ' +
    'products, services, causes, loans, events, wishlists and the rest), your posts with the ' +
    'replies under them, and the messages you sent. What you share with other people stays ' +
    'with them, without your name: their payments, orders, support, offers, tickets, ' +
    'contributions, deals and bookings, and the conversations you were in. Pages you made for ' +
    'a group stay with the group. A group you founded passes to its longest-standing admin, or ' +
    'member if it has no admin; a group with nobody else in it has its pages unpublished. ' +
    'This cannot be undone.',
  unshippedOrders:
    'An order you paid for has not shipped yet, and the seller still needs your address. ' +
    'You can delete your account once it has shipped.',
  notDeleted:
    'Your account was not deleted and none of your data was removed, though apps you had ' +
    'connected were signed out. Please try again.',
} as const;
