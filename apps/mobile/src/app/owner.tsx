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
import { useAuth } from '@/providers/auth-provider';
import { supabase } from '../../lib/supabase';
type Branch = { id: string; name: string };
export default function OwnerScreen() {
  const auth = useAuth();
  const tenantId = auth.activeBusiness?.tenantId;
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState('');
  const [weekly, setWeekly] = useState('');
  const [monthly, setMonthly] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const owner = auth.activeBusiness?.role === 'owner';
  useEffect(() => {
    if (!tenantId || !supabase) return;
    void supabase
      .from('branches')
      .select('id,name')
      .eq('tenant_id', tenantId)
      .order('name')
      .then(({ data }) => {
        const rows = (data ?? []) as Branch[];
        setBranches(rows);
        setBranchId(rows[0]?.id ?? '');
      });
  }, [tenantId]);
  async function saveTarget(period: 'weekly' | 'monthly', value: string) {
    if (!tenantId || !branchId || !supabase) return;
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a target greater than zero.');
      return;
    }
    const { error: saveError } = await supabase.rpc('set_branch_sales_target', {
      target_tenant_id: tenantId,
      target_branch_id: branchId,
      target_period: period,
      target_amount: amount,
    });
    if (saveError) setError(saveError.message);
    else
      setMessage(`${period[0].toUpperCase() + period.slice(1)} target saved.`);
  }
  async function invite() {
    if (!tenantId || !branchId || !supabase || !email.trim()) return;
    setError(null);
    const { error: invokeError } = await supabase.functions.invoke(
      'invite-cashier',
      { body: { email: email.trim().toLowerCase(), tenantId, branchId } },
    );
    if (invokeError) setError(invokeError.message);
    else {
      setEmail('');
      setMessage('Cashier invitation email sent.');
    }
  }
  if (!owner)
    return (
      <ThemedView style={styles.screen}>
        <SafeAreaView style={styles.safe}>
          <View style={styles.content}>
            <PageHeader
              breadcrumb="ADMINISTRATION · SANI TECH"
              title="Owner Portal"
              subtitle="Only the business owner can manage prices, targets, and cashier accounts."
            />
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content}>
          <PageHeader
            breadcrumb="ADMINISTRATION · SANI TECH"
            title="Owner Control Center"
            subtitle="Control branch sales targets, cashier invitations, and business permissions"
            badge="Owner Access"
          />
          <View style={styles.choices}>
            {branches.map((branch) => (
              <Pressable
                key={branch.id}
                onPress={() => setBranchId(branch.id)}
                style={[
                  styles.choice,
                  branch.id === branchId && styles.selected,
                ]}
              >
                <ThemedText>{branch.name}</ThemedText>
              </Pressable>
            ))}
          </View>
          <Section title="Sales targets">
            <Field
              label="Weekly sales target (ZMW)"
              value={weekly}
              onChangeText={setWeekly}
            />
            <Button
              label="Save weekly target"
              onPress={() => void saveTarget('weekly', weekly)}
            />
            <Field
              label="Monthly sales target (ZMW)"
              value={monthly}
              onChangeText={setMonthly}
            />
            <Button
              label="Save monthly target"
              onPress={() => void saveTarget('monthly', monthly)}
            />
          </Section>
          <Section title="Create cashier account">
            <ThemedText themeColor="textSecondary">
              The cashier is assigned to this branch only. Their email
              invitation creates their sign-in.
            </ThemedText>
            <Field
              label="Cashier email"
              value={email}
              onChangeText={setEmail}
              email
            />
            <Button
              label="Send cashier invitation"
              onPress={() => void invite()}
            />
          </Section>
          {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
          {message ? (
            <ThemedText style={styles.success}>{message}</ThemedText>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <ThemedText type="subtitle">{title}</ThemedText>
      {children}
    </View>
  );
}
function Field({
  label,
  value,
  onChangeText,
  email = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  email?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        keyboardType={email ? 'email-address' : 'decimal-pad'}
        autoCapitalize="none"
        style={[
          styles.input,
          {
            color: theme.text,
            borderColor: theme.backgroundSelected,
            backgroundColor: theme.backgroundElement,
          },
        ]}
      />
    </View>
  );
}
function Button({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.button}>
      <ThemedText style={styles.buttonText}>{label}</ThemedText>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1 },
  content: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  choices: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
  choice: {
    padding: Spacing.two,
    borderWidth: 1,
    borderColor: '#D8E0E8',
    borderRadius: 6,
  },
  selected: { backgroundColor: '#DCEAE6', borderColor: '#147D92' },
  section: {
    gap: Spacing.two,
    borderTopWidth: 1,
    borderColor: '#D8E0E8',
    paddingTop: Spacing.three,
  },
  field: { gap: Spacing.one },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  button: {
    minHeight: 50,
    backgroundColor: '#102A43',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '700' },
  error: { color: '#B42318' },
  success: { color: '#16803C' },
});
