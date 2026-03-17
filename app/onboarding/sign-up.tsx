import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Colors } from "../../constants/colors";
import { supabase } from "../../lib/supabase";

export default function SignUpScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignUp = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("Please enter your email and password.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (data?.session) {
        router.replace("/onboarding/questions");
        return;
      }

      if (data?.user && !data.session) {
        setError(
          "Check your email to confirm your account, then sign in below."
        );
        return;
      }

      setError("Something went wrong. Please try again.");
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
      style={{ backgroundColor: Colors.background }}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        className="flex-1 px-6"
      >
        <View className="flex-1 justify-center py-10">
          <Text
            className="text-2xl font-bold mb-2"
            style={{ color: Colors.primary }}
          >
            Create your account
          </Text>
          <Text
            className="text-base mb-6"
            style={{ color: Colors.midGrey }}
          >
            Sign up to save your progress and stay on track.
          </Text>

          <TextInput
            className="w-full h-12 px-4 rounded-xl mb-3 border"
            style={{
              backgroundColor: Colors.background,
              borderColor: Colors.lightGrey,
              color: Colors.darkText,
            }}
            placeholder="Email"
            placeholderTextColor={Colors.midGrey}
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setError(null);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            editable={!isLoading}
          />

          <TextInput
            className="w-full h-12 px-4 rounded-xl mb-4 border"
            style={{
              backgroundColor: Colors.background,
              borderColor: Colors.lightGrey,
              color: Colors.darkText,
            }}
            placeholder="Password (min 6 characters)"
            placeholderTextColor={Colors.midGrey}
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setError(null);
            }}
            secureTextEntry
            editable={!isLoading}
          />

          {error ? (
            <Text
              className="text-sm mb-4"
              style={{ color: "red" }}
            >
              {error}
            </Text>
          ) : null}

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleSignUp}
            disabled={isLoading}
            className="h-14 rounded-full items-center justify-center mb-4"
            style={{
              backgroundColor: Colors.primary,
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-base font-semibold text-white">
                Sign up
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push("/onboarding/sign-in")}
            disabled={isLoading}
            className="items-center py-2"
          >
            <Text
              className="text-base"
              style={{ color: Colors.primary }}
            >
              Already have an account? Sign in
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
