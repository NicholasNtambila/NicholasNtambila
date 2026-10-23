import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import {
  Image,
  ImageStyle,
  Pressable,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

import { ThemedText } from './themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';

export default function AppTabs() {
  const auth = useAuth();
  const isOwner = auth.activeBusiness?.role === 'owner';
  return (
    <Tabs style={styles.webRoot}>
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="home" href="/" asChild>
            <TabButton>Dashboard</TabButton>
          </TabTrigger>
          {isOwner ? (
            <TabTrigger name="explore" href="/explore" asChild>
              <TabButton>Workspace</TabButton>
            </TabTrigger>
          ) : null}
          <TabTrigger name="operations" href="/operations" asChild>
            <TabButton>Services</TabButton>
          </TabTrigger>
          <TabTrigger name="sell" href="/sell" asChild>
            <TabButton>Sell</TabButton>
          </TabTrigger>
          <TabTrigger name="history" href="/history" asChild>
            <TabButton>History</TabButton>
          </TabTrigger>
          {isOwner ? (
            <TabTrigger name="catalog" href="/catalog" asChild>
              <TabButton>Catalogue</TabButton>
            </TabTrigger>
          ) : null}
          {isOwner ? (
            <TabTrigger name="owner" href="/owner" asChild>
              <TabButton>Owner</TabButton>
            </TabTrigger>
          ) : null}
        </CustomTabList>
      </TabList>
      <TabSlot style={styles.webSlot} />
    </Tabs>
  );
}

export function TabButton({
  children,
  isFocused,
  ...props
}: TabTriggerSlotProps) {
  return (
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      <View
        style={[
          styles.tabButtonView,
          {
            backgroundColor: isFocused
              ? 'rgba(20, 125, 146, 0.22)'
              : 'transparent',
            borderColor: isFocused ? '#147D92' : 'transparent',
          },
        ]}
      >
        <ThemedText
          type="small"
          style={{
            color: isFocused ? '#38BDF8' : '#ABC0BE',
            fontWeight: isFocused ? '700' : '500',
            fontSize: 13,
          }}
        >
          {children}
        </ThemedText>
      </View>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  return (
    <View style={styles.tabListContainer}>
      <View style={styles.innerContainer}>
        <View style={styles.brandGroup}>
          <Image
            source={require('@/assets/images/sanit3ch-logo.png')}
            style={styles.brandLogo}
            resizeMode="contain"
          />
          <View>
            <ThemedText style={styles.brandTitle}>
              SaNi Tech
            </ThemedText>
            <ThemedText style={styles.brandSubtitle}>
              Powering the Digital Pulse
            </ThemedText>
          </View>
        </View>

        <View style={styles.navLinksRow}>{props.children}</View>
      </View>
    </View>
  );
}

const styles = {
  webRoot: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%',
    backgroundColor: '#0B2027',
    overflow: 'hidden',
  } as ViewStyle,
  webSlot: {
    flex: 1,
    height: '100%',
    display: 'flex',
    overflowY: 'auto' as any,
  } as ViewStyle,
  tabListContainer: {
    width: '100%',
    backgroundColor: '#0B2027',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  } as ViewStyle,
  innerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 1200,
    gap: Spacing.two,
  } as ViewStyle,
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  } as ViewStyle,
  brandLogo: {
    width: 32,
    height: 32,
  } as ImageStyle,
  brandTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0284C7',
    lineHeight: 18,
  } as TextStyle,
  brandSubtitle: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  } as TextStyle,
  navLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  } as ViewStyle,
  pressed: {
    opacity: 0.7,
  } as ViewStyle,
  tabButtonView: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  } as ViewStyle,
};
