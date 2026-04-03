import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import CredentialsProvider from "next-auth/providers/credentials";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        isGuest: { label: "Is Guest", type: "text" },
      },
      async authorize(credentials) {
        await dbConnect();

        // --- Guest Login ---
        // Validated against a server-side secret so clients can't spoof this
        if (process.env.GUEST_SECRET && credentials?.isGuest === process.env.GUEST_SECRET) {
          return {
            id: "guest_" + Math.random().toString(36).substr(2, 9),
            name: "Guest User",
            email: `guest_${Date.now()}@mockmate.io`, // unique per session
            image: null,
            role: "guest",
          } as any;
        }

        // --- Credentials Login ---
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        const user = await User.findOne({ email: credentials.email });

        // Use a dummy hash so bcrypt always runs — prevents timing attacks
        // where an attacker can tell whether the email exists based on response time
        const dummyHash =
          "$2b$10$invalidhashfortimingprotectionXXXXXXXXXXXXXXXXXXXXX";
        const isPasswordMatch = await bcrypt.compare(
          credentials.password,
          user?.password || dummyHash
        );

        // Single error for both "user not found" and "wrong password"
        if (!user || !user.password || !isPasswordMatch) {
          throw new Error("Invalid email or password");
        }

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role ?? "user",
        } as any;
      },
    }),
  ],

  callbacks: {
    async signIn({ user, account }) {
      if (
        (account?.provider === "google" || account?.provider === "github") &&
        user.email
      ) {
        try {
          await dbConnect();
          await User.findOneAndUpdate(
            { email: user.email },
            {
              $set: {
                name: user.name ?? "User",
                email: user.email,
                image: user.image ?? null,
                provider: account.provider,
              },
              // Only set role on first insert — don't overwrite if admin later
              $setOnInsert: {
                role: "user",
              },
            },
            {
              upsert: true,
              new: true,
              runValidators: true,
              setDefaultsOnInsert: true,
            }
          );
        } catch (e) {
          console.error("[NextAuth] MongoDB signIn error:", e);
          // Redirect back to auth page with a readable error instead of NextAuth's blank error page
          return "/auth?error=DatabaseError";
        }
      }
      return true;
    },

    async jwt({ token, user, account }) {
      // On initial sign-in, `user` is populated
      if (user) {
        token.id = user.id;
        token.role = (user as any).role ?? "user";
      }

      // For OAuth providers, re-fetch from DB to get the persisted role and id
      // (because the OAuth `user` object doesn't have role or our Mongo _id)
      if (account?.provider === "google" || account?.provider === "github") {
        try {
          await dbConnect();
          const dbUser = await User.findOne({ email: token.email });
          if (dbUser) {
            token.id = dbUser._id.toString();
            token.role = dbUser.role ?? "user";
          }
        } catch (e) {
          console.error("[NextAuth] JWT DB lookup error:", e);
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role ?? "user";
      }
      return session;
    },
  },

  session: {
    strategy: "jwt",
  },

  pages: {
    signIn: "/auth",
  },

  secret: process.env.NEXTAUTH_SECRET,
};