import { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from "react-native";
import { AppButton, CreditCardCard, EmptyState } from "../components";
import { colors, spacing } from "../styles/theme";
import type { CreditCard } from "../types";
import { formatCurrencyWithCents } from "../utils/formatters";

type CreditCardsScreenProps = {
  cards: CreditCard[];
  onAddCard: () => void;
  onEditCard: (card: CreditCard) => void;
};

export function CreditCardsScreen({
  cards,
  onAddCard,
  onEditCard,
}: CreditCardsScreenProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const cardOffsets = useRef<Record<string, number>>({});
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const selectedCard = useMemo(
    () => cards.find((card) => card.id === selectedCardId) ?? null,
    [cards, selectedCardId]
  );
  const selectedIndex = selectedCard
    ? cards.findIndex((card) => card.id === selectedCard.id)
    : -1;

  useEffect(() => {
    if (
      Platform.OS === "android" &&
      UIManager.setLayoutAnimationEnabledExperimental
    ) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    if (selectedCardId && !cards.some((card) => card.id === selectedCardId)) {
      setSelectedCardId(null);
    }
  }, [cards, selectedCardId]);

  function selectCard(cardId: string) {
    const nextSelectedCardId = cardId === selectedCardId ? null : cardId;

    LayoutAnimation.configureNext(
      {
        duration: 380,
        create: {
          duration: 220,
          property: LayoutAnimation.Properties.opacity,
          type: LayoutAnimation.Types.easeInEaseOut,
        },
        delete: {
          duration: 180,
          property: LayoutAnimation.Properties.opacity,
          type: LayoutAnimation.Types.easeInEaseOut,
        },
        update: {
          duration: 380,
          type: LayoutAnimation.Types.easeInEaseOut,
        },
      },
      () => {
        if (!nextSelectedCardId) {
          return;
        }

        const y = cardOffsets.current[nextSelectedCardId];

        if (typeof y === "number") {
          scrollViewRef.current?.scrollTo({
            animated: true,
            y: Math.max(y - spacing.lg, 0),
          });
        }
      }
    );
    setSelectedCardId(nextSelectedCardId);
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      ref={scrollViewRef}
      style={styles.screen}
    >
      {cards.length > 0 ? (
        <View style={styles.walletStack}>
          {cards.map((card, index) => {
            const selected = selectedCard?.id === card.id;
            const followsExpandedCard = selectedIndex >= 0 && index > selectedIndex;

            return (
              <View
                key={card.id}
                onLayout={(event) => {
                  cardOffsets.current[card.id] = event.nativeEvent.layout.y;
                }}
                style={[
                  styles.walletItem,
                  index > 0 && styles.overlappedWalletItem,
                  followsExpandedCard && styles.afterExpandedWalletItem,
                ]}
              >
                <CreditCardCard
                  card={card}
                  index={index}
                  onPress={() => selectCard(card.id)}
                  selected={selected}
                />

                {selected ? (
                  <View style={styles.inlineDetails}>
                    <View style={styles.inlineHeader}>
                      <View style={styles.inlineTitleWrap}>
                        <Text style={styles.inlineEyebrow}>Selected card</Text>
                        <Text style={styles.selectedName}>{card.name}</Text>
                      </View>
                      <AppButton
                        label="Edit"
                        onPress={() => onEditCard(card)}
                        variant="secondary"
                      />
                    </View>

                    <View style={styles.detailGrid}>
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>APR</Text>
                        <Text style={styles.detailValue}>{card.apr.toFixed(2)}%</Text>
                      </View>
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Minimum payment</Text>
                        <Text style={styles.detailValue}>
                          {formatCurrencyWithCents(card.minimumMonthlyPayment)}
                        </Text>
                      </View>
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Balance</Text>
                        <Text style={styles.detailValue}>
                          {formatCurrencyWithCents(card.balance)}
                        </Text>
                      </View>
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Due day</Text>
                        <Text style={styles.detailValue}>{card.dueDay}</Text>
                      </View>
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : (
        <EmptyState
          actionLabel="Add card"
          message="Add each credit card balance so the dashboard can show your combined debt."
          onAction={onAddCard}
          title="No cards yet"
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  screen: {
    backgroundColor: colors.background,
  },
  walletStack: {
    paddingBottom: spacing.md,
    paddingTop: spacing.sm,
  },
  walletItem: {
    position: "relative",
  },
  overlappedWalletItem: {
    marginTop: -112,
  },
  afterExpandedWalletItem: {
    marginTop: spacing.lg,
  },
  inlineDetails: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    gap: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.lg,
  },
  inlineHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  inlineTitleWrap: {
    flex: 1,
  },
  inlineEyebrow: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "900",
    marginBottom: spacing.xs,
    textTransform: "uppercase",
  },
  selectedName: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
  },
  detailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  detailItem: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 16,
    flexGrow: 1,
    minWidth: "46%",
    padding: spacing.md,
  },
  detailLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: spacing.xs,
    textTransform: "uppercase",
  },
  detailValue: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "900",
  },
});
