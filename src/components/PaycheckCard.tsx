import { useEffect, useRef } from "react";
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, radii, spacing } from "../styles/theme";
import type { PaycheckPlan } from "../types";
import { formatDateLabel } from "../utils/dateHelpers";
import { formatCurrency, formatCurrencyWithCents } from "../utils/formatters";
import {
  getActualPaymentTotal,
  getPlannedPaymentTotal,
} from "../utils/payoffCalculator";
import { AppButton } from "./AppButton";
import { StatusBadge } from "./StatusBadge";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type PaycheckCardProps = {
  paycheck: PaycheckPlan;
  onEdit: () => void;
  onCheckIn: () => void;
  onDelete: () => void;
  closeSignal?: number;
  onSwipeActiveChange?: (active: boolean) => void;
};

export function PaycheckCard({
  paycheck,
  onEdit,
  onCheckIn,
  onDelete,
  closeSignal = 0,
  onSwipeActiveChange,
}: PaycheckCardProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(1)).current;
  const openOffset = -104;
  const isOpen = useRef(false);
  const dragStartOffset = useRef(0);
  const currentOffset = useRef(0);
  const actualAmount = paycheck.actualCardPayment;
  const plannedTotal = getPlannedPaymentTotal(paycheck);
  const actualTotal = getActualPaymentTotal(paycheck);
  const expectedPaycheck = paycheck.expectedPaycheckAmount;
  const plannedRemaining =
    typeof expectedPaycheck === "number"
      ? expectedPaycheck - plannedTotal
      : undefined;
  const actualRemaining =
    typeof expectedPaycheck === "number" && paycheck.status !== "planned"
      ? expectedPaycheck - actualTotal
      : undefined;
  const hasActualCheckIn = paycheck.status !== "planned";
  const primaryPaymentLabel = hasActualCheckIn
    ? "Actual card payment"
    : "Planned card payment";
  const primaryPayment =
    hasActualCheckIn ? actualTotal : plannedTotal;
  const remainingLabel = hasActualCheckIn
    ? "Remaining after actual"
    : "Remaining after plan";
  const remainingAmount = hasActualCheckIn ? actualRemaining : plannedRemaining;
  const difference =
    hasActualCheckIn
      ? actualTotal - plannedTotal
      : undefined;
  const deleteOpacity = translateX.interpolate({
    extrapolate: "clamp",
    inputRange: [openOffset, -24, 0],
    outputRange: [1, 0.35, 0],
  });
  const deleteScale = translateX.interpolate({
    extrapolate: "clamp",
    inputRange: [openOffset, -24, 0],
    outputRange: [1, 0.94, 0.9],
  });

  function animateTo(value: number, onComplete?: () => void) {
    currentOffset.current = value;
    Animated.timing(translateX, {
      duration: 180,
      toValue: value,
      useNativeDriver: false,
    }).start(() => {
      isOpen.current = value !== 0;
      onComplete?.();
    });
  }

  function closeWithoutAnimation() {
    translateX.stopAnimation();
    currentOffset.current = 0;
    dragStartOffset.current = 0;
    isOpen.current = false;
    translateX.setValue(0);
  }

  useEffect(() => {
    closeWithoutAnimation();
  }, [closeSignal]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 4 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 0.65,
      onMoveShouldSetPanResponderCapture: (_, gesture) =>
        Math.abs(gesture.dx) > 4 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 0.65,
      onPanResponderGrant: () => {
        onSwipeActiveChange?.(true);
        translateX.stopAnimation((value) => {
          dragStartOffset.current = value;
          currentOffset.current = value;
        });
      },
      onPanResponderMove: (_, gesture) => {
        const nextValue = Math.max(openOffset, Math.min(0, dragStartOffset.current + gesture.dx));
        currentOffset.current = nextValue;
        translateX.setValue(nextValue);
      },
      onPanResponderRelease: (_, gesture) => {
        const shouldOpen =
          gesture.vx < -0.45 ||
          currentOffset.current < openOffset / 2 ||
          (isOpen.current && gesture.dx < 40);
        animateTo(shouldOpen ? openOffset : 0, () => onSwipeActiveChange?.(false));
      },
      onPanResponderTerminate: () => {
        animateTo(0, () => onSwipeActiveChange?.(false));
      },
    })
  ).current;

  function handleDelete() {
    Animated.parallel([
      Animated.timing(translateX, {
        duration: 220,
        toValue: -420,
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        duration: 180,
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start(onDelete);
  }

  return (
    <View style={styles.swipeWrap}>
      <AnimatedPressable
        accessibilityRole="button"
        onPress={handleDelete}
        style={[
          styles.deleteAction,
          {
            opacity: deleteOpacity,
            transform: [{ scale: deleteScale }],
          },
        ]}
      >
        <Text style={styles.deleteText}>Delete</Text>
      </AnimatedPressable>

      <Animated.View
        style={[styles.card, { opacity: cardOpacity, transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.date}>{formatDateLabel(paycheck.paycheckDate)}</Text>
            <Text style={styles.subtle}>
              Expected paycheck:{" "}
              {typeof paycheck.expectedPaycheckAmount === "number"
                ? formatCurrency(paycheck.expectedPaycheckAmount)
                : "Not entered"}
            </Text>
          </View>
          <StatusBadge status={paycheck.status} />
        </View>

        <View style={styles.amountRow}>
          <View style={styles.amountBlock}>
            <Text style={styles.amountLabel}>{primaryPaymentLabel}</Text>
            <Text style={styles.amount}>{formatCurrencyWithCents(primaryPayment)}</Text>
          </View>
          {typeof remainingAmount === "number" ? (
            <View style={styles.amountBlock}>
              <Text style={styles.amountLabel}>{remainingLabel}</Text>
              <Text
                style={[
                  styles.amount,
                  remainingAmount < 0 ? styles.negative : styles.positive,
                ]}
              >
                {formatCurrencyWithCents(remainingAmount)}
              </Text>
            </View>
          ) : null}
        </View>

        {typeof expectedPaycheck !== "number" ? (
          <Text style={styles.helper}>
            Add an expected paycheck amount to see what remains after the card payment.
          </Text>
        ) : null}

        {typeof difference === "number" ? (
          <Text
            style={[
              styles.difference,
              difference >= 0 ? styles.positive : styles.negative,
            ]}
          >
            {difference >= 0 ? "+" : ""}
            {formatCurrencyWithCents(difference)} vs plan
          </Text>
        ) : null}

        {paycheck.note ? <Text style={styles.note}>{paycheck.note}</Text> : null}

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={onEdit}
            style={styles.linkButton}
          >
            <Text style={styles.linkText}>Edit</Text>
          </Pressable>
          <AppButton
            label={paycheck.status === "planned" ? "Check in" : "Update"}
            onPress={onCheckIn}
            variant="secondary"
          />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  swipeWrap: {
    borderRadius: radii.md,
    overflow: "hidden",
  },
  deleteAction: {
    alignItems: "center",
    backgroundColor: "#FF3B30",
    bottom: 0,
    justifyContent: "center",
    position: "absolute",
    right: 0,
    top: 0,
    width: 96,
  },
  deleteText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    padding: spacing.lg,
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  headerText: {
    flex: 1,
  },
  date: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  subtle: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: spacing.xs,
  },
  amountRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  amountBlock: {
    flex: 1,
  },
  amountLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: spacing.xs,
  },
  amount: {
    color: colors.text,
    fontSize: 21,
    fontWeight: "800",
  },
  helper: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  difference: {
    fontSize: 14,
    fontWeight: "800",
  },
  positive: {
    color: colors.green,
  },
  negative: {
    color: colors.red,
  },
  note: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  linkButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
  linkText: {
    color: colors.blue,
    fontSize: 15,
    fontWeight: "800",
  },
});
