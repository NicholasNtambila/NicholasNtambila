import { designTokens } from '@sanitech/shared';
import { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PageHeader } from '@/components/page-header';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth, type BusinessRole } from '@/providers/auth-provider';
import { supabase } from '../../lib/supabase';

type Branch = {
  id: string;
  name: string;
  timezone: string;
  is_headquarters: boolean;
};

type Member = {
  role: BusinessRole;
  branch_scope: 'all' | 'selected';
};

type WorkspaceData = {
  tenantId: string;
  branches: Branch[];
  members: Member[];
  error: string | null;
};

const inviteRoles: { value: BusinessRole; label: string }[] = [
  { value: 'administrator', label: 'Administrator' },
  { value: 'manager', label: 'Manager' },
  { value: 'cashier', label: 'Cashier' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'read_only_viewer', label: 'Read-only viewer' },
];

export default function TeamAndBranches() {
  const auth = useAuth();
  const theme = useTheme();
  const tenantId = auth.activeBusiness?.tenantId;
  const [workspaceData, setWorkspaceData] = useState<WorkspaceData | null>(
    null,
  );
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] =
    useState<BusinessRole>('read_only_viewer');
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [branchError, setBranchError] = useState<string | null>(null);
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);

  useEffect(() => {
    if (!tenantId || !supabase) return;

    let isCurrent = true;
    void Promise.all([
      supabase
        .from('branches')
        .select('id, name, timezone, is_headquarters')
        .eq('tenant_id', tenantId)
        .order('name'),
      supabase
        .from('business_members')
        .select('role, branch_scope')
        .eq('tenant_id', tenantId),
    ])
      .then(([branchResult, memberResult]) => {
        if (!isCurrent) return;
        if (branchResult.error) throw branchResult.error;
        if (memberResult.error) throw memberResult.error;

        setWorkspaceData({
          tenantId,
          branches: (branchResult.data ?? []) as Branch[],
          members: (memberResult.data ?? []) as Member[],
          error: null,
        });
      })
      .catch(() => {
        if (isCurrent) {
          setWorkspaceData({
            tenantId,
            branches: [],
            members: [],
            error: 'Workspace access details could not be loaded.',
          });
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [tenantId]);

  const data = workspaceData?.tenantId === tenantId ? workspaceData : null;
  const branches = data?.branches ?? [];
  const members = data?.members ?? [];
  const isLoading = Boolean(tenantId && !data);
  const canInvite =
    auth.activeBusiness?.role === 'owner' ||
    auth.activeBusiness?.role === 'administrator';
  const needsBranchScope = inviteRole === 'manager' || inviteRole === 'cashier';

  function toggleBranch(branchId: string) {
    setSelectedBranchIds((current) =>
      current.includes(branchId)
        ? current.filter((selectedId) => selectedId !== branchId)
        : [...current, branchId],
    );
  }

  async function createBranch() {
    setBranchError(null);
    const normalizedName = newBranchName.trim();
    if (!tenantId || !supabase) return;
    if (normalizedName.length < 1 || normalizedName.length > 120) {
      setBranchError('Branch name must be between 1 and 120 characters.');
      return;
    }

    setIsCreatingBranch(true);
    try {
      const { data: branch, error } = await supabase
        .from('branches')
        .insert({
          tenant_id: tenantId,
          name: normalizedName,
          timezone: auth.activeBusiness?.timezone ?? 'Africa/Lusaka',
        })
        .select('id, name, timezone, is_headquarters')
        .single();
      if (error) throw error;

      setWorkspaceData((current) =>
        current?.tenantId === tenantId
          ? {
              ...current,
              branches: [...current.branches, branch as Branch].sort(
                (left, right) => left.name.localeCompare(right.name),
              ),
            }
          : current,
      );
      setNewBranchName('');
    } catch (error) {
      setBranchError(
        error instanceof Error
          ? error.message
          : 'Branch creation could not be completed.',
      );
    } finally {
      setIsCreatingBranch(false);
    }
  }

  async function createInvitation() {
    setInviteError(null);
    setInviteToken(null);
    if (!tenantId || !supabase) return;

    if (!inviteEmail.trim()) {
      setInviteError('Enter the teammate’s email address.');
      return;
    }
    if (needsBranchScope && selectedBranchIds.length === 0) {
      setInviteError('Select at least one branch for this role.');
      return;
    }

    setIsInviting(true);
    try {
      const { data: token, error } = await supabase.rpc(
        'create_tenant_invitation',
        {
          target_tenant_id: tenantId,
          invite_email: inviteEmail.trim().toLowerCase(),
          invite_role: inviteRole,
          allowed_branch_ids: needsBranchScope ? selectedBranchIds : [],
        },
      );
      if (error) throw error;
      if (typeof token !== 'string' || token.length < 32) {
        throw new Error('The server did not return a valid invitation token.');
      }

      setInviteToken(token);
      setInviteEmail('');
      setSelectedBranchIds([]);
    } catch (error) {
      setInviteError(
        error instanceof Error
          ? error.message
          : 'The invitation could not be created.',
      );
    } finally {
      setIsInviting(false);
    }
  }

  const roleCounts = members.reduce<Partial<Record<BusinessRole, number>>>(
    (counts, member) => {
      counts[member.role] = (counts[member.role] ?? 0) + 1;
      return counts;
    },
    {},
  );

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <PageHeader
            breadcrumb="WORKSPACE & TEAM · SANI TECH"
            title="Team & Branch Management"
            subtitle={auth.activeBusiness?.name ? `${auth.activeBusiness.name} · Role-based permissions and branch configuration` : 'Manage workspace members and multi-branch operations'}
          />

          {isLoading ? (
            <ThemedText themeColor="textSecondary">
              Loading access details…
            </ThemedText>
          ) : null}
          {data?.error ? (
            <ThemedText
              style={{ color: designTokens.color.negative }}
              accessibilityRole="alert"
            >
              {data.error}
            </ThemedText>
          ) : null}

          {!isLoading && !data?.error ? (
            <>
              <View style={styles.section}>
                <ThemedText type="subtitle">Accessible branches</ThemedText>
                {branches.length === 0 ? (
                  <ThemedText themeColor="textSecondary">
                    No branches are available to this role.
                  </ThemedText>
                ) : (
                  branches.map((branch) => (
                    <View key={branch.id} style={styles.listRow}>
                      <View style={styles.rowMain}>
                        <ThemedText>{branch.name}</ThemedText>
                        {branch.is_headquarters ? (
                          <ThemedText type="small" themeColor="textSecondary">
                            Head office
                          </ThemedText>
                        ) : null}
                      </View>
                      <ThemedText type="small" themeColor="textSecondary">
                        {branch.timezone}
                      </ThemedText>
                    </View>
                  ))
                )}
              </View>

              {canInvite ? (
                <View style={styles.section}>
                  <ThemedText type="subtitle">Add a branch</ThemedText>
                  <TextInput
                    accessibilityLabel="New branch name"
                    autoCapitalize="words"
                    onChangeText={setNewBranchName}
                    placeholder="Branch name"
                    placeholderTextColor={theme.textSecondary}
                    value={newBranchName}
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.backgroundElement,
                        borderColor: theme.backgroundSelected,
                        color: theme.text,
                      },
                    ]}
                  />
                  {branchError ? (
                    <ThemedText
                      style={{ color: designTokens.color.negative }}
                      accessibilityRole="alert"
                    >
                      {branchError}
                    </ThemedText>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    disabled={isCreatingBranch}
                    onPress={() => void createBranch()}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      {
                        backgroundColor: designTokens.color.brand.blue,
                        opacity: isCreatingBranch ? 0.55 : pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <ThemedText style={styles.buttonText}>
                      {isCreatingBranch ? 'Creating branch…' : 'Create branch'}
                    </ThemedText>
                  </Pressable>
                </View>
              ) : null}

              <View style={styles.section}>
                <ThemedText type="subtitle">Team access</ThemedText>
                <ThemedText themeColor="textSecondary">
                  {members.length} active{' '}
                  {members.length === 1 ? 'member' : 'members'}
                </ThemedText>
                {inviteRoles.map(({ value, label }) =>
                  roleCounts[value] ? (
                    <View key={value} style={styles.listRow}>
                      <ThemedText>{label}</ThemedText>
                      <ThemedText themeColor="textSecondary">
                        {roleCounts[value]}
                      </ThemedText>
                    </View>
                  ) : null,
                )}
                {roleCounts.owner ? (
                  <View style={styles.listRow}>
                    <ThemedText>Owner</ThemedText>
                    <ThemedText themeColor="textSecondary">
                      {roleCounts.owner}
                    </ThemedText>
                  </View>
                ) : null}
              </View>

              {canInvite ? (
                <View style={styles.section}>
                  <ThemedText type="subtitle">Invite a teammate</ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.helper}>
                    The token is shown once. Deliver it securely; email delivery
                    is not configured.
                  </ThemedText>
                  <TextInput
                    accessibilityLabel="Teammate email address"
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    onChangeText={setInviteEmail}
                    placeholder="Email address"
                    placeholderTextColor={theme.textSecondary}
                    value={inviteEmail}
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.backgroundElement,
                        borderColor: theme.backgroundSelected,
                        color: theme.text,
                      },
                    ]}
                  />

                  <View style={styles.choiceList}>
                    {inviteRoles.map(({ value, label }) => {
                      const selected = inviteRole === value;
                      return (
                        <Pressable
                          key={value}
                          accessibilityRole="radio"
                          accessibilityState={{ selected }}
                          onPress={() => {
                            setInviteRole(value);
                            setSelectedBranchIds([]);
                          }}
                          style={[
                            styles.roleChoice,
                            {
                              borderColor: selected
                                ? designTokens.color.brand.blue
                                : theme.backgroundSelected,
                              backgroundColor: selected
                                ? '#E8F4F5'
                                : 'transparent',
                            },
                          ]}
                        >
                          <ThemedText>{label}</ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>

                  {needsBranchScope ? (
                    <View style={styles.choiceList}>
                      <ThemedText type="smallBold">Branch access</ThemedText>
                      {branches.map((branch) => {
                        const selected = selectedBranchIds.includes(branch.id);
                        return (
                          <Pressable
                            key={branch.id}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: selected }}
                            onPress={() => toggleBranch(branch.id)}
                            style={styles.checkRow}
                          >
                            <View
                              style={[
                                styles.checkBox,
                                {
                                  borderColor: selected
                                    ? designTokens.color.brand.blue
                                    : theme.textSecondary,
                                  backgroundColor: selected
                                    ? designTokens.color.brand.blue
                                    : 'transparent',
                                },
                              ]}
                            />
                            <ThemedText>{branch.name}</ThemedText>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}

                  {inviteError ? (
                    <ThemedText
                      style={{ color: designTokens.color.negative }}
                      accessibilityRole="alert"
                    >
                      {inviteError}
                    </ThemedText>
                  ) : null}
                  {inviteToken ? (
                    <View style={styles.tokenNotice}>
                      <ThemedText type="smallBold">
                        One-time invitation token
                      </ThemedText>
                      <ThemedText selectable style={styles.token}>
                        {inviteToken}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        Share this with {inviteEmail || 'the invited teammate'}{' '}
                        now. The server stores only its hash.
                      </ThemedText>
                    </View>
                  ) : null}

                  <Pressable
                    accessibilityRole="button"
                    disabled={isInviting}
                    onPress={() => void createInvitation()}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      {
                        backgroundColor: designTokens.color.brand.blue,
                        opacity: isInviting ? 0.55 : pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <ThemedText style={styles.buttonText}>
                      {isInviting ? 'Creating invite…' : 'Create invitation'}
                    </ThemedText>
                  </Pressable>
                </View>
              ) : null}
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safeArea: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    paddingBottom: 64,
    gap: Spacing.two,
  },
  section: {
    borderTopWidth: 1,
    borderColor: '#D8E0E8',
    paddingTop: Spacing.three,
    marginTop: Spacing.three,
    gap: Spacing.two,
  },
  listRow: {
    minHeight: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rowMain: { gap: Spacing.one },
  helper: { lineHeight: 21 },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  choiceList: { gap: Spacing.one },
  roleChoice: {
    minHeight: 42,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: Spacing.two,
  },
  checkRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  checkBox: { width: 20, height: 20, borderWidth: 1, borderRadius: 3 },
  tokenNotice: {
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  token: { fontFamily: 'monospace', fontSize: 14, lineHeight: 20 },
  primaryButton: {
    minHeight: 50,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: { color: '#FFFFFF', fontWeight: '700' },
});
