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
import { DEFAULT_UNIFIED_CATALOG } from '../../lib/pos-data';

type Branch = { id: string; name: string };
type Service = { id: string; name: string; default_price: number };

export default function CatalogScreen() {
  const auth = useAuth();
  const tenantId = auth.activeBusiness?.tenantId;
  const canManage = auth.activeBusiness?.role === 'owner';
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState('');
  const [services, setServices] = useState<Service[]>([]);
  const [productName, setProductName] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productCost, setProductCost] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [servicePrice, setServicePrice] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = () => {
    if (!tenantId || !supabase) return;
    void Promise.all([
      supabase
        .from('branches')
        .select('id,name')
        .eq('tenant_id', tenantId)
        .order('name'),
      supabase
        .from('service_offerings')
        .select('id,name,default_price')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('name'),
    ]).then(([branchResult, serviceResult]) => {
      const next = (branchResult.data ?? []) as Branch[];
      setBranches(next);
      setBranchId((current) => current || next[0]?.id || '');
      setServices((serviceResult.data ?? []) as Service[]);
    });
  };
  useEffect(load, [tenantId]);
  async function addProduct() {
    if (!tenantId || !supabase || !auth.session) return;
    const selling = Number(productPrice);
    const cost = Number(productCost);
    if (
      !productName.trim() ||
      !Number.isFinite(selling) ||
      selling < 0 ||
      !Number.isFinite(cost) ||
      cost < 0
    ) {
      setError('Enter a product name, selling price, and cost estimate.');
      return;
    }
    const { error: insertError } = await supabase.from('products').insert({
      tenant_id: tenantId,
      name: productName.trim(),
      selling_price: selling,
      unit_cost_estimate: cost,
      created_by: auth.session.user.id,
    });
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setProductName('');
    setProductPrice('');
    setProductCost('');
    setMessage('Product created. Receive its stock in Operations.');
  }
  async function addService() {
    if (!tenantId || !supabase || !auth.session) return;
    const numeric = Number(servicePrice);
    if (!serviceName.trim() || !Number.isFinite(numeric) || numeric < 0) {
      setError('Enter a service name and valid price.');
      return;
    }
    const { data, error: insertError } = await supabase
      .from('service_offerings')
      .insert({
        tenant_id: tenantId,
        name: serviceName.trim(),
        default_price: numeric,
        created_by: auth.session.user.id,
      })
      .select('id')
      .single();
    if (insertError || !data) {
      setError(insertError?.message ?? 'Could not create service.');
      return;
    }
    if (branchId) {
      const { error: enableError } = await supabase
        .from('branch_service_offerings')
        .upsert({
          tenant_id: tenantId,
          branch_id: branchId,
          service_id: data.id,
          price: numeric,
          is_enabled: true,
        });
      if (enableError) {
        setError(enableError.message);
        return;
      }
    }
    setServiceName('');
    setServicePrice('');
    setMessage('Service created and enabled for this branch.');
    load();
  }
  async function toggle(service: Service) {
    if (!tenantId || !branchId || !supabase) return;
    const { data } = await supabase
      .from('branch_service_offerings')
      .select('is_enabled')
      .eq('tenant_id', tenantId)
      .eq('branch_id', branchId)
      .eq('service_id', service.id)
      .maybeSingle();
    const { error: saveError } = await supabase
      .from('branch_service_offerings')
      .upsert({
        tenant_id: tenantId,
        branch_id: branchId,
        service_id: service.id,
        price: service.default_price,
        is_enabled: !data?.is_enabled,
      });
    if (saveError) setError(saveError.message);
    else
      setMessage(
        `${service.name} ${data?.is_enabled ? 'disabled' : 'enabled'} for this branch.`,
      );
  }
  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content}>
          <PageHeader
            breadcrumb="CATALOGUE · SANI TECH SERVICES"
            title="Service Catalogue & Rates"
            subtitle="Configure branch rates, printing, stationery, barbing, and technology services"
            badge={`${DEFAULT_UNIFIED_CATALOG.length} standard items`}
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
          {canManage ? (
            <>
              <Form title="Add a stocked product">
                <Input
                  label="Product name"
                  value={productName}
                  onChangeText={setProductName}
                />
                <Input
                  label="Selling price (ZMW)"
                  value={productPrice}
                  onChangeText={setProductPrice}
                  numeric
                />
                <Input
                  label="Cost estimate (ZMW)"
                  value={productCost}
                  onChangeText={setProductCost}
                  numeric
                />
                <Button
                  label="Create product"
                  onPress={() => void addProduct()}
                />
              </Form>
              <Form title="Add a service">
                <Input
                  label="Service name"
                  value={serviceName}
                  onChangeText={setServiceName}
                />
                <Input
                  label="Default price (ZMW)"
                  value={servicePrice}
                  onChangeText={setServicePrice}
                  numeric
                />
                <Button
                  label="Create service"
                  onPress={() => void addService()}
                />
              </Form>
            </>
          ) : null}
          <Form title="Branch services">
            {services.length === 0 ? (
              <ThemedText themeColor="textSecondary">
                Create services such as printing, photocopying, barbing,
                laminating, binding, accessories, or stationery.
              </ThemedText>
            ) : (
              services.map((service) => (
                <Pressable
                  key={service.id}
                  disabled={!canManage}
                  onPress={() => void toggle(service)}
                  style={styles.row}
                >
                  <ThemedText>{service.name}</ThemedText>
                  <ThemedText themeColor="textSecondary">
                    K{Number(service.default_price).toFixed(2)} · tap to
                    enable/disable
                  </ThemedText>
                </Pressable>
              ))
            )}
          </Form>

          {/* SaniT3ch Official Master Price List */}
          <Form title="📋 SaniT3ch Master Price Board & Service Rates">
            <ThemedText themeColor="textSecondary" style={{ fontSize: 12, marginBottom: 8 }}>
              Standard verified rates applied across POS checkout, receipts, and quotations.
            </ThemedText>
            {DEFAULT_UNIFIED_CATALOG.map((item) => (
              <View
                key={item.id}
                style={[
                  styles.row,
                  {
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingVertical: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
                  },
                ]}
              >
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <ThemedText type="smallBold">{item.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11 }}>
                    {item.description || item.category}
                  </ThemedText>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <ThemedText type="subtitle" style={{ color: '#0284C7' }}>
                    K{item.price.toFixed(2)}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 10 }}>
                    per {item.unit || 'unit'}
                  </ThemedText>
                </View>
              </View>
            ))}
          </Form>
          {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
          {message ? (
            <ThemedText style={styles.success}>{message}</ThemedText>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}
function Form({
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
function Input({
  label,
  value,
  onChangeText,
  numeric = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  numeric?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
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
    backgroundColor: '#147D92',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '700' },
  row: { paddingVertical: Spacing.two, gap: Spacing.one },
  error: { color: '#B42318' },
  success: { color: '#16803C' },
});
