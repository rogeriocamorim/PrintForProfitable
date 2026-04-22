import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as GitHubStrategy } from "passport-github2";
import bcrypt from "bcryptjs";
import prisma from "./prisma.js";

passport.serializeUser((user: Express.User, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

// Local Strategy
passport.use(
  new LocalStrategy(
    { usernameField: "email" },
    async (email, password, done) => {
      try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.password) {
          return done(null, false, { message: "Invalid email or password" });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          return done(null, false, { message: "Invalid email or password" });
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

// Google OAuth Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL:
          process.env.GOOGLE_CALLBACK_URL ||
          "http://localhost:3001/api/auth/google/callback",
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          let user = await prisma.user.findFirst({
            where: { provider: "google", providerId: profile.id },
          });
          if (!user) {
            user = await prisma.user.create({
              data: {
                email: profile.emails?.[0]?.value ?? `google-${profile.id}@noemail.com`,
                name: profile.displayName,
                avatar: profile.photos?.[0]?.value,
                provider: "google",
                providerId: profile.id,
                farms: {
                  create: { name: "My Farm" },
                },
              },
            });
          }
          return done(null, user);
        } catch (err) {
          return done(err as Error);
        }
      }
    )
  );
}

// GitHub OAuth Strategy
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL:
          process.env.GITHUB_CALLBACK_URL ||
          "http://localhost:3001/api/auth/github/callback",
      },
      async (
        _accessToken: string,
        _refreshToken: string,
        profile: any,
        done: (err: Error | null, user?: Express.User) => void
      ) => {
        try {
          let user = await prisma.user.findFirst({
            where: { provider: "github", providerId: profile.id },
          });
          if (!user) {
            user = await prisma.user.create({
              data: {
                email:
                  (profile.emails?.[0]?.value as string) ??
                  `github-${profile.id}@noemail.com`,
                name: profile.displayName || profile.username || "GitHub User",
                avatar: profile.photos?.[0]?.value,
                provider: "github",
                providerId: profile.id,
                farms: {
                  create: { name: "My Farm" },
                },
              },
            });
          }
          return done(null, user);
        } catch (err) {
          return done(err as Error);
        }
      }
    )
  );
}

export default passport;
