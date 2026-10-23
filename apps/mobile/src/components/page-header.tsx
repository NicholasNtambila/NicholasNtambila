import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';
import { Spacing } from '@/constants/theme';

interface PageHeaderProps {
  breadcrumb?: string;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  actionSlot?: React.ReactNode;
}

export function PageHeader({
  breadcrumb,
  title,
  subtitle,
  badge,
  actionSlot,
}: PageHeaderProps) {
  return (
    <View style={styles.headerContainer}>
      <View style={styles.textContainer}>
        {breadcrumb ? (
          <ThemedText style={styles.breadcrumbText}>
            {breadcrumb.toUpperCase()}
          </ThemedText>
        ) : null}
        <View style={styles.titleRow}>
          <ThemedText style={styles.titleText}>{title}</ThemedText>
          {badge ? (
            typeof badge === 'string' ? (
              <View style={styles.badgePill}>
                <ThemedText style={styles.badgeText}>{badge}</ThemedText>
              </View>
            ) : (
              badge
            )
          ) : null}
        </View>
        {subtitle ? (
          <ThemedText themeColor="textSecondary" style={styles.subtitleText}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {actionSlot ? <View style={styles.actionSlot}>{actionSlot}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginBottom: Spacing.three,
    paddingBottom: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  textContainer: {
    flex: 1,
  },
  breadcrumbText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#147D92',
    letterSpacing: 1,
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  titleText: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  badgePill: {
    backgroundColor: 'rgba(20, 125, 146, 0.15)',
    borderColor: '#147D92',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#147D92',
  },
  subtitleText: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  actionSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
