import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing } from "../styles/theme";
import type { CreditCard } from "../types";
import { formatCurrencyWithCents } from "../utils/formatters";

type CreditCardCardProps = {
  card: CreditCard;
  index: number;
  selected: boolean;
  onPress: () => void;
};

const cardPalettes = [
  { backgroundColor: "#111111", accentColor: "#4ECDC4", textColor: "#FFFFFF" },
  { backgroundColor: "#B2132B", accentColor: "#FFCB45", textColor: "#FFFFFF" },
  { backgroundColor: "#1E293B", accentColor: "#38BDF8", textColor: "#FFFFFF" },
  { backgroundColor: "#243B35", accentColor: "#86EFAC", textColor: "#FFFFFF" },
  { backgroundColor: "#4B3A6D", accentColor: "#F0C95A", textColor: "#FFFFFF" },
];

export function CreditCardCard({
  card,
  index,
  selected,
  onPress,
}: CreditCardCardProps) {
  const palette = cardPalettes[index % cardPalettes.length];
  const darkText = palette.textColor !== "#FFFFFF";

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.walletCard,
        selected && styles.selectedCard,
        pressed && styles.pressed,
        {
          backgroundColor: palette.backgroundColor,
          borderColor: "rgba(255,255,255,0.16)",
          zIndex: index + 1,
        },
      ]}
    >
      <View
        pointerEvents="none"
        style={[
          styles.orb,
          { backgroundColor: palette.accentColor, opacity: darkText ? 0.16 : 0.28 },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.diagonal,
          { backgroundColor: palette.accentColor, opacity: darkText ? 0.1 : 0.18 },
        ]}
      />

      <View style={styles.cardTop}>
        <View style={styles.chip}>
          <View style={styles.chipLine} />
          <View style={styles.chipLine} />
        </View>
        <Text style={[styles.cardKind, { color: palette.textColor }]}>
          CREDIT CARD
        </Text>
      </View>

      <View style={styles.cardMiddle}>
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          numberOfLines={1}
          style={[styles.cardName, { color: palette.textColor }]}
        >
          {card.name}
        </Text>
        <Text style={[styles.balanceLabel, { color: palette.textColor }]}>
          Balance
        </Text>
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.72}
          numberOfLines={1}
          style={[styles.balance, { color: palette.textColor }]}
        >
          {formatCurrencyWithCents(card.balance)}
        </Text>
      </View>

      <View style={styles.cardBottom}>
        <Text style={[styles.cardNetwork, { color: palette.textColor }]}>
          Payoff
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  walletCard: {
    aspectRatio: 1.72,
    borderRadius: 0,
    borderWidth: 2,
    justifyContent: "space-between",
    overflow: "hidden",
    padding: spacing.lg,
    width: "100%",
  },
  selectedCard: {
    aspectRatio: 1.56,
    transform: [{ translateY: -4 }],
  },
  pressed: {
    opacity: 0.92,
  },
  orb: {
    borderRadius: 140,
    height: 240,
    position: "absolute",
    right: -78,
    top: -90,
    width: 240,
  },
  diagonal: {
    bottom: -70,
    height: 170,
    left: -24,
    position: "absolute",
    transform: [{ rotate: "-18deg" }],
    width: "120%",
  },
  cardTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  chip: {
    backgroundColor: "#E3C56E",
    borderRadius: radii.sm,
    height: 32,
    justifyContent: "space-evenly",
    paddingHorizontal: spacing.sm,
    width: 44,
  },
  chipLine: {
    backgroundColor: "rgba(0,0,0,0.2)",
    height: StyleSheet.hairlineWidth,
  },
  cardKind: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0,
    opacity: 0.72,
  },
  cardMiddle: {
    gap: spacing.xs,
  },
  cardName: {
    fontSize: 24,
    fontWeight: "900",
  },
  balanceLabel: {
    fontSize: 13,
    fontWeight: "800",
    opacity: 0.66,
  },
  balance: {
    fontSize: 34,
    fontWeight: "900",
  },
  cardBottom: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  cardNetwork: {
    fontSize: 18,
    fontWeight: "900",
    opacity: 0.86,
  },
});
