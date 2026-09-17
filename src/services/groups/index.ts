/**
 * GroupsService Class
 *
 * Provides a class-based interface for groups operations.
 * Internally uses the modular functions.
 */
import type { AnySupabaseClient } from '@/lib/supabase/types';

class GroupsService {
  // Group management
  async createGroup(input: Parameters<typeof import('./mutations/groups').createGroup>[0]) {
    return import('./mutations/groups').then(m => m.createGroup(input));
  }

  async getGroup(
    identifier: string,
    bySlug: boolean = false,
    client?: Parameters<typeof import('./queries/groups').getGroup>[2]
  ) {
    return import('./queries/groups').then(m => m.getGroup(identifier, bySlug, client));
  }

  async updateGroup(
    groupId: string,
    input: Parameters<typeof import('./mutations/groups').updateGroup>[1]
  ) {
    return import('./mutations/groups').then(m => m.updateGroup(groupId, input));
  }

  async deleteGroup(groupId: string) {
    return import('./mutations/groups').then(m => m.deleteGroup(groupId));
  }

  async getUserGroups(
    query?: Parameters<typeof import('./queries/groups').getUserGroups>[0],
    pagination?: Parameters<typeof import('./queries/groups').getUserGroups>[1]
  ) {
    return import('./queries/groups').then(m => m.getUserGroups(query, pagination));
  }

  async getAvailableGroups(
    query?: Parameters<typeof import('./queries/groups').getAvailableGroups>[0],
    pagination?: Parameters<typeof import('./queries/groups').getAvailableGroups>[1]
  ) {
    return import('./queries/groups').then(m => m.getAvailableGroups(query, pagination));
  }

  async searchGroups(
    searchQuery: string,
    filters?: Parameters<typeof import('./queries/groups').searchGroups>[1],
    pagination?: Parameters<typeof import('./queries/groups').searchGroups>[2]
  ) {
    return import('./queries/groups').then(m => m.searchGroups(searchQuery, filters, pagination));
  }

  // Member management
  async joinGroup(
    groupId: string,
    client?: Parameters<typeof import('./mutations/members').joinGroup>[1]
  ) {
    return import('./mutations/members').then(m => m.joinGroup(groupId, client));
  }

  async leaveGroup(groupId: string) {
    return import('./mutations/members').then(m => m.leaveGroup(groupId));
  }

  async getGroupMembers(
    groupId: string,
    pagination?: { page?: number; pageSize?: number },
    client?: Parameters<typeof import('./queries/members').getGroupMembers>[2]
  ) {
    return import('./queries/members').then(m => m.getGroupMembers(groupId, pagination, client));
  }

  async addMember(
    groupId: string,
    input: Parameters<typeof import('./mutations/members').addMember>[1]
  ) {
    return import('./mutations/members').then(m => m.addMember(groupId, input));
  }

  async updateMember(
    groupId: string,
    memberId: string,
    input: Parameters<typeof import('./mutations/members').updateMember>[2]
  ) {
    return import('./mutations/members').then(m => m.updateMember(groupId, memberId, input));
  }

  async removeMember(groupId: string, memberId: string) {
    return import('./mutations/members').then(m => m.removeMember(groupId, memberId));
  }

  // Wallet management
  async getGroupWallets(groupId: string) {
    return import('./queries/wallets').then(m => m.getGroupWallets(groupId));
  }

  async createGroupWallet(
    request: Parameters<typeof import('./mutations/wallets').createGroupWallet>[0]
  ) {
    return import('./mutations/wallets').then(m => m.createGroupWallet(request));
  }

  async updateGroupWallet(
    walletId: string,
    request: Parameters<typeof import('./mutations/wallets').updateGroupWallet>[1]
  ) {
    return import('./mutations/wallets').then(m => m.updateGroupWallet(walletId, request));
  }

  // Activity tracking
  async getGroupActivities(
    groupId: string,
    query?: Parameters<typeof import('./queries/activities').getGroupActivities>[1],
    pagination?: Parameters<typeof import('./queries/activities').getGroupActivities>[2]
  ) {
    return import('./queries/activities').then(m =>
      m.getGroupActivities(groupId, query, pagination)
    );
  }

  // Invitation management
  async createInvitation(
    input: Parameters<typeof import('./mutations/invitations').createInvitation>[0]
  ) {
    return import('./mutations/invitations').then(m => m.createInvitation(input));
  }

  async acceptInvitation(invitationId: string) {
    return import('./mutations/invitations').then(m => m.acceptInvitation(invitationId));
  }

  async declineInvitation(invitationId: string) {
    return import('./mutations/invitations').then(m => m.declineInvitation(invitationId));
  }

  async acceptInvitationByToken(token: string) {
    return import('./mutations/invitations').then(m => m.acceptInvitationByToken(token));
  }

  async revokeInvitation(invitationId: string) {
    return import('./mutations/invitations').then(m => m.revokeInvitation(invitationId));
  }

  async getUserPendingInvitations() {
    return import('./queries/invitations').then(m => m.getUserPendingInvitations());
  }

  async getUserInvitationCount() {
    return import('./queries/invitations').then(m => m.getUserInvitationCount());
  }

  async getGroupInvitations(
    groupId: string,
    options?: Parameters<typeof import('./queries/invitations').getGroupInvitations>[1]
  ) {
    return import('./queries/invitations').then(m => m.getGroupInvitations(groupId, options));
  }

  async getInvitationByToken(token: string) {
    return import('./queries/invitations').then(m => m.getInvitationByToken(token));
  }

  // Event management
  async createEvent(input: Parameters<typeof import('./mutations/events').createEvent>[0]) {
    return import('./mutations/events').then(m => m.createEvent(input));
  }

  async updateEvent(
    eventId: string,
    input: Parameters<typeof import('./mutations/events').updateEvent>[1]
  ) {
    return import('./mutations/events').then(m => m.updateEvent(eventId, input));
  }

  async deleteEvent(eventId: string) {
    return import('./mutations/events').then(m => m.deleteEvent(eventId));
  }

  async rsvpToEvent(
    eventId: string,
    status: Parameters<typeof import('./mutations/events').rsvpToEvent>[1]
  ) {
    return import('./mutations/events').then(m => m.rsvpToEvent(eventId, status));
  }

  async getGroupEvents(
    groupId: string,
    options?: Parameters<typeof import('./queries/events').getGroupEvents>[1]
  ) {
    return import('./queries/events').then(m => m.getGroupEvents(groupId, options));
  }

  async getEvent(eventId: string) {
    return import('./queries/events').then(m => m.getEvent(eventId));
  }

  async getEventRsvps(eventId: string) {
    return import('./queries/events').then(m => m.getEventRsvps(eventId));
  }

  async getUpcomingEvents(groupId: string, limit?: number) {
    return import('./queries/events').then(m => m.getUpcomingEvents(groupId, limit));
  }

  async getUserRsvpStatus(eventId: string) {
    return import('./queries/events').then(m => m.getUserRsvpStatus(eventId));
  }

  // Proposal management
  async createProposal(
    input: Parameters<typeof import('./mutations/proposals').createProposal>[0]
  ) {
    return import('./mutations/proposals').then(m => m.createProposal(input));
  }

  async getGroupProposals(
    groupId: string,
    options?: Parameters<typeof import('./queries/proposals').getGroupProposals>[1]
  ) {
    return import('./queries/proposals').then(m => m.getGroupProposals(groupId, options));
  }

  async getProposal(proposalId: string) {
    return import('./queries/proposals').then(m => m.getProposal(proposalId));
  }

  async updateProposal(
    proposalId: string,
    updates: Parameters<typeof import('./mutations/proposals').updateProposal>[1]
  ) {
    return import('./mutations/proposals').then(m => m.updateProposal(proposalId, updates));
  }

  async activateProposal(proposalId: string) {
    return import('./mutations/proposals').then(m => m.activateProposal(proposalId));
  }

  async cancelProposal(proposalId: string) {
    return import('./mutations/proposals').then(m => m.cancelProposal(proposalId));
  }

  async deleteProposal(proposalId: string) {
    return import('./mutations/proposals').then(m => m.deleteProposal(proposalId));
  }

  // Vote management — uses indirect import to prevent webpack from pulling
  // server-only code (execution/ -> domain/projects/service -> next/headers)
  // into the client bundle
  async castVote(input: { proposal_id: string; vote: 'yes' | 'no' | 'abstain' }) {
    const mod = './mutations/votes';
    return import(/* webpackIgnore: true */ mod).then(m => m.castVote(input));
  }

  async getProposalVotes(proposalId: string) {
    return import('./queries/proposals').then(m => m.getProposalVotes(proposalId));
  }

  // Permissions.
  //
  // `client` is not optional in practice on the server: without it the
  // permission layer falls back to the BROWSER supabase client, which carries
  // no session outside the browser. The check then runs as anon, finds no
  // membership, and denies — so a member was told they could not vote, could
  // not create a proposal, and could not manage settings. Pass the
  // request-scoped client from every server caller.
  async checkGroupPermission(
    groupId: string,
    userId: string,
    permission: Parameters<typeof import('./permissions').checkGroupPermission>[2],
    client?: AnySupabaseClient
  ) {
    return import('./permissions').then(m =>
      m.checkGroupPermission(groupId, userId, permission, client)
    );
  }
}

// Export singleton instance
const groupsService = new GroupsService();
export default groupsService;
