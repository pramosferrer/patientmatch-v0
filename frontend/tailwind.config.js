/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx,js,jsx}",
    "./components/**/*.{ts,tsx,js,jsx}",
    "./pages/**/*.{ts,tsx,js,jsx}",
    "./shared/**/*.{ts,tsx,js,jsx}",
    "./lib/**/*.{ts,tsx,js,jsx}",
  ],
  safelist: [
    // Dynamic chip/button classes with common shades
    {
      pattern: /^(bg|text|border)-(red|green|yellow|blue|purple|pink|indigo|gray|slate)-(50|100|200|500|600|700|800)$/,
    },
    // Patient brand colors with common shades
    {
      pattern: /^(bg|text|border)-(teal|rose|amber|violet|emerald|sky|slate)-(50|100|200|500|600|700|800)$/,
    },
    // Specific combinations we use in our color system
    'bg-emerald-50', 'text-emerald-800', 'border-emerald-200',
    'bg-emerald-100', 'text-emerald-700', 'border-emerald-200',
    'bg-amber-50', 'text-amber-800', 'border-amber-200',
    'bg-amber-100', 'text-amber-700', 'border-amber-200',
    'bg-red-50', 'text-red-700', 'border-red-200',
    'bg-red-100', 'text-red-700', 'border-red-200',
    'bg-violet-50', 'text-violet-700', 'border-violet-200',
    'bg-violet-100', 'text-violet-700', 'border-violet-200',
    'bg-rose-50', 'text-rose-700', 'border-rose-200',
    'bg-rose-100', 'text-rose-700', 'border-rose-200',
    'bg-teal-50', 'text-teal-800', 'border-teal-200',
    'bg-teal-100', 'text-teal-800', 'border-teal-200',
    'bg-indigo-50', 'text-indigo-700', 'border-indigo-200',
    'bg-indigo-100', 'text-indigo-700', 'border-indigo-200',
    'bg-cyan-50', 'text-cyan-700', 'border-cyan-200',
    'bg-cyan-100', 'text-cyan-700', 'border-cyan-200',
    'bg-slate-50', 'text-slate-700', 'border-slate-200',
    'bg-slate-100', 'text-slate-700', 'border-slate-200',
    'bg-pink-50', 'text-pink-700', 'border-pink-200',
    'bg-pink-100', 'text-pink-700', 'border-pink-200',
    'bg-sky-50', 'text-sky-700', 'border-sky-200',
    'bg-sky-100', 'text-sky-700', 'border-sky-200',
    // Button hover states
    'hover:bg-emerald-700', 'hover:bg-amber-700', 'hover:bg-red-700',
    'hover:bg-violet-700', 'hover:bg-rose-700', 'hover:bg-teal-700',
    'hover:bg-indigo-700', 'hover:bg-cyan-700', 'hover:bg-slate-700',
    'hover:bg-pink-700', 'hover:bg-sky-700',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px'
      }
    },
    extend: {
      colors: {
        border: "var(--color-border)",
        "border-strong": "var(--color-border-strong)",
        input: "var(--color-border)",
        ring: "var(--color-focus)",
        background: "var(--color-background)",
        foreground: "var(--color-foreground)",
        primary: {
          DEFAULT: "var(--color-primary)",
          strong: "var(--color-primary-strong)",
          foreground: "var(--color-primary-foreground)"
        },
        secondary: {
          DEFAULT: "var(--color-secondary)",
          foreground: "var(--color-secondary-foreground)"
        },
        accent: {
          DEFAULT: "var(--color-accent)",
          foreground: "var(--color-accent-foreground)"
        },
        destructive: {
          DEFAULT: "var(--color-destructive)",
          foreground: "var(--color-destructive-foreground)"
        },
        muted: {
          DEFAULT: "var(--color-muted)",
          foreground: "var(--color-muted-foreground)"
        },
        success: {
          DEFAULT: "var(--color-success)",
          foreground: "var(--color-success-foreground)"
        },
        pm: {
          primary: "var(--color-primary)",
          primaryHover: "var(--color-primary-strong)",
          secondary: "var(--color-accent)",
          surface: "var(--color-card)",
          bg: "var(--color-background)",
          warmCream: "var(--color-surface-cream)",
          brightCream: "var(--color-surface-petal)",
          softBlue: "var(--aurora-mint)",
          border: "var(--color-border)",
          hairline: "var(--pm-hairline)",
          ink: "var(--color-foreground)",
          body: "var(--color-muted)",
          muted: "var(--color-muted-foreground)",
          ring: "var(--color-focus)",
          success: "var(--color-success)",
          successForeground: "var(--color-success-foreground)",
        },
        warm: {
          cream: "var(--color-surface-cream)",
          petal: "var(--color-surface-petal)",
          rose: "var(--color-surface-rose)",
          sage: "var(--color-surface-sage)",
          veil: "var(--color-surface-veil)"
        },
        affirm: {
          DEFAULT: "var(--color-affirm)",
          soft: "var(--color-affirm-soft)"
        },
        // Semantic status colors - break monochromatic green
        urgency: {
          DEFAULT: "var(--color-urgency)",
          soft: "var(--color-urgency-soft)",
          strong: "var(--color-urgency-strong)"
        },
        distance: {
          DEFAULT: "var(--color-distance)",
          soft: "var(--color-distance-soft)"
        },
        phase: {
          DEFAULT: "var(--color-phase)",
          soft: "var(--color-phase-soft)"
        },
        sponsor: {
          DEFAULT: "var(--color-sponsor)",
          soft: "var(--color-sponsor-soft)"
        },
        caution: {
          DEFAULT: "var(--color-caution)",
          soft: "var(--color-caution-soft)"
        },
        invitation: {
          DEFAULT: "var(--color-invitation)",
          soft: "var(--color-invitation-soft)"
        },
        aurora: {
          mint: "var(--aurora-mint)",
          blush: "var(--aurora-blush)",
          coral: "var(--aurora-coral)",
          amber: "var(--aurora-amber)"
        }
      },
      fontFamily: {
        // Default UI/body = Inter
        sans: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
        // Headings/CTAs/chips = Manrope
        heading: ["var(--font-heading)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Merriweather", "Georgia", "serif"],
        // Display font for trial titles and key headlines = Fraunces
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      letterSpacing: {
        tightish: "-0.01em",
      },
      borderRadius: {
        lg: '1rem',
        md: '0.85rem',
        sm: '0.75rem',
        xl: '1.25rem',
        '2xl': '1.75rem'
      },
      boxShadow: {
        card: 'var(--shadow-card-soft)',
        aurora: 'var(--shadow-aurora)',
        warm: 'var(--shadow-warm)'
      },
      backgroundColor: {
        'surface-sage': 'var(--color-surface-sage)',
        'surface-cream': 'var(--color-surface-cream)',
        'surface-petal': 'var(--color-surface-petal)',
        'surface-rose': 'var(--color-surface-rose)',
      },
      transitionTimingFunction: {
        gentle: 'cubic-bezier(0.22, 1, 0.36, 1)'
      },
      keyframes: {
        aurora: {
          '0%': { transform: 'translate3d(-14%, -8%, 0) scale(1)', opacity: '0.6' },
          '50%': { transform: 'translate3d(8%, 6%, 0) scale(1.05)', opacity: '0.85' },
          '100%': { transform: 'translate3d(-14%, -8%, 0) scale(1)', opacity: '0.6' }
        },
        shimmer: {
          '0%,100%': { opacity: '0.35' },
          '50%': { opacity: '0.58' }
        },
        'accordion-down': {
          from: {
            height: '0'
          },
          to: {
            height: 'var(--radix-accordion-content-height)'
          }
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)'
          },
          to: {
            height: '0'
          }
        }
      },
      animation: {
        aurora: 'aurora var(--aurora-speed) ease-in-out infinite',
        shimmer: 'shimmer calc(var(--aurora-speed) * 0.6) ease-in-out infinite',
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out'
      },
      backgroundImage: {
        'aurora-soft': 'var(--aurora-gradient)'
      }
    }
  },
  plugins: [require("tailwindcss-animate")],
};
