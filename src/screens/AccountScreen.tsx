import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { AppButton } from "../components";
import { colors, spacing } from "../styles/theme";
import type { CloudSession } from "../services/cloudAccount";

type AccountScreenProps = {
  error: string | null;
  lastSyncedAt: string | null;
  loading: boolean;
  session: CloudSession | null;
  onClearError: () => void;
  onDownloadCloud: () => void;
  onSignIn: (email: string, password: string) => void;
  onSignOut: () => void;
  onSignUp: (email: string, password: string) => void;
};

function formatTimestamp(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "Not synced";
}

export function AccountScreen({
  error,
  lastSyncedAt,
  loading,
  session,
  onClearError,
  onDownloadCloud,
  onSignIn,
  onSignOut,
  onSignUp,
}: AccountScreenProps) {
  const [email, setEmail] = useState(session?.user.email ?? "");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const visibleError = formError ?? error;
  const isNotice = visibleError?.startsWith("Account created.") ?? false;

  function clearFormError() {
    if (formError) {
      setFormError(null);
    }

    if (error) {
      onClearError();
    }
  }

  function validateCredentials(): string | null {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      return "Enter your email address.";
    }

    if (!trimmedEmail.includes("@")) {
      return "Enter a valid email address.";
    }

    if (!password) {
      return "Enter your password.";
    }

    if (password.length < 6) {
      return "Password must be at least 6 characters.";
    }

    return null;
  }

  function handleSignInPress() {
    const validationError = validateCredentials();

    if (validationError) {
      setFormError(validationError);
      return;
    }

    onSignIn(email.trim(), password);
  }

  function handleSignUpPress() {
    const validationError = validateCredentials();

    if (validationError) {
      setFormError(validationError);
      return;
    }

    onSignUp(email.trim(), password);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {session ? (
          <View style={styles.stack}>
            <View style={styles.groupedList}>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Email</Text>
                <Text numberOfLines={1} style={styles.value}>
                  {session.user.email ?? "Signed in"}
                </Text>
              </View>
              <View style={styles.separator} />
              <View style={styles.infoRow}>
                <Text style={styles.label}>Last synced</Text>
                <Text style={styles.value}>{formatTimestamp(lastSyncedAt)}</Text>
              </View>
            </View>

            <View style={styles.actions}>
              <AppButton
                disabled={loading}
                label="Restore cloud data"
                onPress={onDownloadCloud}
                variant="secondary"
              />
              <AppButton
                disabled={loading}
                label="Sign out"
                onPress={onSignOut}
                variant="ghost"
              />
            </View>
          </View>
        ) : (
          <View style={styles.stack}>
            <View style={styles.groupedList}>
              <View style={styles.fieldRow}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  autoCapitalize="none"
                  keyboardType="email-address"
                  onChangeText={(value) => {
                    setEmail(value);
                    clearFormError();
                  }}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  value={email}
                />
              </View>
              <View style={styles.separator} />
              <View style={styles.fieldRow}>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  onChangeText={(value) => {
                    setPassword(value);
                    clearFormError();
                  }}
                  placeholder="Minimum 6 characters"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                  style={styles.input}
                  value={password}
                />
              </View>
            </View>

            <View style={styles.actions}>
              <AppButton
                disabled={loading}
                label="Sign in"
                loading={loading}
                onPress={handleSignInPress}
              />
              <AppButton
                disabled={loading}
                label="Create account"
                onPress={handleSignUpPress}
                variant="secondary"
              />
            </View>
          </View>
        )}

        {visibleError ? (
          <Text style={[styles.message, isNotice ? styles.notice : styles.error]}>
            {visibleError}
          </Text>
        ) : null}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 0,
  },
  content: {
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  stack: {
    gap: spacing.md,
  },
  groupedList: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  fieldRow: {
    gap: spacing.xs,
    minHeight: 78,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  infoRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  separator: {
    backgroundColor: colors.border,
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing.lg,
  },
  label: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  value: {
    color: colors.textMuted,
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    textAlign: "right",
  },
  input: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "500",
    minHeight: 30,
    padding: 0,
  },
  actions: {
    gap: spacing.sm,
  },
  message: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  notice: {
    color: colors.green,
  },
  error: {
    color: colors.red,
  },
});
