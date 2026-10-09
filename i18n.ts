import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const LANGUAGE_STORAGE_KEY = 'cadlift_language';

const getInitialLanguage = () => {
  if (typeof window === 'undefined') {
    return 'en';
  }
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === 'en' || stored === 'de') {
      return stored;
    }
    const browserLang = window.navigator.language?.toLowerCase();
    if (browserLang?.startsWith('de')) return 'de';
    return 'en';
  } catch {
    return 'en';
  }
};

const resources = {
  en: {
    translation: {
      common: {
        title: 'CADLift',
        home: 'Home',
        about: 'About',
        theme_dark: 'Dark Mode',
        theme_light: 'Light Mode',
        footer_text: '(c) 2026 CADLift. All rights reserved.',
        footer_made: 'Made with love by',
        footer_docs: 'Docs',
        footer_support: 'Support',
        footer_github: 'GitHub',
        convert: 'Convert to 3D',
        upload_title: 'Upload DXF or PDF File',
        upload_drag: 'Drag and drop your DXF, DWG or PDF plan here, or click to select',
        upload_hint: 'Max file size: 50MB. Supported formats: .dxf, .dwg, .pdf (vector)',
        mode_label: 'Conversion Mode',
        unit_label: 'Unit',
        height_label: 'Extrusion Height',
        upload_invalid_format: 'Invalid file format. Only .dxf, .dwg and .pdf files are supported.',
        upload_too_large: 'File too large (Max 50MB).',
        plan_width_label: 'Plan Width (m)',
        plan_width_hint: 'Real width of the drawn floor plate. Leave empty to estimate from workstation symbols.',
        viewer_fly_on: 'Fly mode: on',
        viewer_fly_off: 'Fly mode: off',
        viewer_controls_title: 'Controls',
        viewer_controls_rotate: 'Left drag: rotate',
        viewer_controls_pan: 'Right drag: pan',
        viewer_controls_zoom: 'Scroll: zoom',
        viewer_controls_fly: 'W A S D: fly, Q / E: down / up, Shift: faster',
        viewer_loading: 'Loading 3D model...',
        viewer_error: 'Failed to load 3D model',
        plan_chat_title: 'Edit with AI',
        plan_chat_hint: 'Describe changes to colours, heights or visibility. Changes apply to whole layers.',
        plan_chat_placeholder: 'e.g. make all furniture warm wood',
        plan_chat_send: 'Send',
        plan_chat_undo: 'Undo',
        plan_chat_busy: 'Updating model...',
        plan_chat_layers: 'Layers ({{count}})',
        plan_chat_hidden: 'hidden',
        plan_chat_floor: 'Floor',
        plan_chat_skipped: 'Not applied: {{items}}',
        plan_chat_you: 'You',
        plan_chat_ai: 'AI',
        plan_chat_suggestion_1: 'Make all furniture warm wood',
        plan_chat_suggestion_2: 'Floor dark grey concrete',
        plan_chat_suggestion_3: 'Make the green furniture 1.2m tall leaf-green plants',
        plan_chat_suggestion_4: 'Walls off-white and 2.8m tall',
        mode_floor: 'Floor Plan (Walls)',
        mode_mech: 'Mechanical Part',
        status_pending: 'Pending...',
        status_processing: 'Processing Geometry...',
        status_completed: 'Conversion Complete!',
        status_failed: 'Conversion Failed',
        status_queued: 'Queued',
        status_cancelled: 'Cancelled',
        download_btn: 'Download 3D Model',
        start_new: 'Convert Another File',
        processing_step_1: 'Parsing DXF entities...',
        processing_step_2: 'Detecting closed loops...',
        processing_step_3: 'Generating 3D mesh...'
      },
      navigation: {
        dashboard: 'Dashboard',
        dashboard_btn: 'Go to Dashboard',
        docs: 'Documentation',
        about: 'About',
        viewOnGithub: 'View on GitHub'
      },
      home: {
        hero: {
          badge: 'Free & Open Source',
          title1: 'Turn',
          title2: 'Anything',
          title3: 'Into',
          title4: '3D',
          subtitle: 'From',
          subtitleCad: 'CAD files',
          subtitleTo: 'to',
          subtitleImages: 'images',
          subtitlePrompts: 'text prompts',
          subtitleEnd: '— generate production-ready 3D models locally.',
          primaryCta: 'Open Dashboard',
          secondaryCta: 'View on GitHub',
          inputTypes: {
            dwg: 'DWG / DXF',
            images: 'Images',
            prompts: 'AI Prompts'
          }
        },
        features: {
          badge: 'Powerful Features',
          title: 'Three Ways to',
          titleAccent: 'Create',
          subtitle: 'Choose your input method. Everything runs locally on your machine.',
          cad: {
            title: 'DWG/DXF to 3D',
            description: 'Upload AutoCAD files directly. Layer detection and extrusion happens instantly on your device.',
            features: ['Native DWG support', 'Privacy focused', 'Auto layer detection', 'Closed shape extrusion']
          },
          image: {
            title: 'Image to 3D',
            description: 'Transform any image into a detailed 3D model using local AI models.'
          },
          prompt: {
            title: 'Prompt to 3D',
            description: 'Just describe it. AI generates an image and builds your user model entirely offline.'
          },
          viewer: {
            title: '3D Viewer',
            description: 'Preview before export'
          },
          export: {
            title: 'Multi-Format',
            description: 'GLB, STL, DXF, STEP'
          }
        },
        howItWorks: {
          title: 'How It',
          titleAccent: 'Works',
          subtitle: 'Three simple steps to 3D',
          steps: [
            { title: 'Download App', description: 'Get the desktop app from GitHub to start' },
            { title: 'Load Input', description: 'Drop your CAD file, image, or type a prompt' },
            { title: 'Local AI Processing', description: 'Your GPU generates the 3D model instantly' }
          ]
        },
        cta: {
          badge: '100% Free & Open Source',
          title: 'Ready to',
          titleAccent: 'Contribute',
          subtitle: 'Join our community on GitHub. Star the repo, fork the code, or download the latest release to get started.',
          button: 'Get Desktop App'
        }
      },
      resourcesPage: {
        heading: 'Resources',
        subheading: 'Guides, documentation, and support to keep you moving.',
        cards: {
          docs: { title: 'Documentation', desc: 'REST endpoints, webhooks, and payload schemas.' },
          videos: { title: 'Tutorial Videos', desc: 'Watch end-to-end walkthroughs in both EN and TR.' },
          faq: { title: 'FAQ', desc: 'Limits, supported formats, and troubleshooting.' },
          community: { title: 'Community & Support', desc: 'Join the forum or open a support ticket.' }
        }
      },
      dashboard: {
        hero: {
          greeting: 'Welcome back',
          newUser: 'Welcome to CADLift',
          tagline: 'Your 3D Creation Studio',
          quickAction: 'Quick Action',
          createNew: 'Create New',
          viewProjects: 'View Projects',
          stats: {
            conversions: 'Conversions',
            thisWeek: 'This Week',
            successRate: 'Success Rate',
            avgTime: 'Avg. Time'
          },
          emptyState: {
            title: 'Ready to create?',
            subtitle: 'Choose a workflow below to start your first 3D model'
          },
          signedInAs: 'Signed in as',
          signOut: 'Sign Out'
        },
        modes: {
          title: 'Conversion Modes',
          subtitle:
            'Pick the workflow that matches your input. Every mode inherits your language and theme preferences.',
          cad: {
            title: 'AutoCAD 2D → 3D Conversion',
            description: 'Upload DXF/DWG drawings and automatically extrude clean architectural or mechanical solids.',
            badge: 'DXF / DWG',
            cta: 'Upload CAD File'
          },
          image: {
            title: 'Image to 2D/3D Generator',
            description: 'Turn sketches, floor plans, or product shots into CAD-ready references.',
            optionsLabel: 'Available Outputs',
            option2d: 'Vector 2D plan',
            option3d: 'Watertight 3D mesh',
            cta: 'Upload Image'
          },
          prompt: {
            title: 'Text Prompt to 2D/3D',
            description: 'Describe what you need and let CADLift draft the geometry automatically.',
            examplesLabel: 'Prompt Ideas',
            exampleOne: 'Draw a 3x4m room with a south-facing window.',
            exampleTwo: 'Generate a lightweight L-bracket with two M6 holes.',
            cta: 'Start Prompt Generation'
          },
          comingSoon: 'Coming Soon',
          betaLabel: 'Beta'
        },
        recent: {
          title: 'Recent Activity',
          subtitle: 'Monitor past runs, download solids, or retry failed jobs.',
          empty: 'No jobs yet. Start a conversion to populate this timeline.',
          table: {
            type: 'Job Type',
            input: 'Input',
            output: 'Output',
            status: 'Status',
            created: 'Created',
            actions: 'Actions'
          },
          action: {
            view: 'View',
            download: 'Download',
            retry: 'Retry'
          },
          time_two_hours: '2 hours ago',
          time_ten_minutes: '10 minutes ago',
          time_yesterday: 'Yesterday',
          time_just_now: 'Just now'
        },
        quickLinks: {
          title: 'Resources',
          subtitle: 'Guides, documentation, and support to keep you moving.',
          documentation: {
            title: 'Documentation',
            description: 'REST endpoints, webhooks, and payload schemas.'
          },
          tutorials: {
            title: 'Tutorial Videos',
            description: 'Watch end-to-end walkthroughs in both EN and TR.'
          },
          faq: {
            title: 'FAQ',
            description: 'Limits, supported formats, and troubleshooting.'
          },
          support: {
            title: 'Community & Support',
            description: 'Join the forum or open a support ticket.'
          }
        },
        workspace: {
          title: 'Conversion Workspace',
          subtitle: 'Upload a DXF, set extrusion parameters, and track progress in real time.',
          statusReady: 'System ready. Waiting for input...'
        },
        quickStart: {
          title: 'Quick Start',
          description: 'Launch a workflow in one tap or use keyboard shortcuts.',
          actions: {
            uploadCad: 'Upload CAD',
            uploadImage: 'Upload Image',
            startPrompt: 'Start Prompt'
          }
        },
        tips: {
          title: 'Onboarding Tips',
          upload: 'Upload a CAD file to begin the classic 2D → 3D extrusion.',
          prompt: 'Try the prompt generator for text-first explorations.',
          dismiss: 'Got it'
        },
        imageForm: {
          title: 'Image to CAD Workflow',
          description: 'Turn sketches, scans, or product photos into vector plans or meshes.',
          uploadLabel: 'Drop an image or click to browse',
          uploadHint: 'Supported: PNG, JPG, SVG up to 25MB',
          pickButton: 'Choose Image',
          option2d: {
            title: 'Vector 2D Output',
            desc: 'Generate clean DXF curves and layers.'
          },
          option3d: {
            title: '3D Mesh Output',
            desc: 'Reconstruct watertight meshes ready for CAD apps.'
          },
          notesLabel: 'Notes',
          notesPlaceholder: 'Tell us about scale, unit assumptions, or desired detail.',
          submit: 'Generate from Image',
          submitLoading: 'Processing image...',
          errors: {
            unsupported: 'Unsupported file type. Please use PNG/JPG/SVG.',
            tooLarge: 'Image exceeds 25MB limit.',
            required: 'Please attach an image to continue.'
          }
        },
        promptForm: {
          title: 'Prompt to Geometry',
          description: 'Describe the space or part. CADLift drafts loops and solids.',
          promptLabel: 'What should we draw?',
          placeholder: 'e.g. Cylindrical adapter with 50mm diameter and two bolt patterns...',
          option2d: {
            title: '2D Draft',
            desc: 'Outputs DXF lines and arcs suitable for review.'
          },
          option3d: {
            title: '3D Concept',
            desc: 'Outputs lightweight STEP meshes.'
          },
          detailLabel: 'Detail Level',
          detailLow: 'Loose',
          detailHigh: 'Precise',
          submit: 'Generate Object',
          submitLoading: 'Generating...',
          errors: {
            required: 'Please describe what you need.'
          }
        }
      },
      aboutLegacy: {
        heading: 'About CADLift',
        description:
          'CADLift transforms your 2D technical drawings into 3D models instantly. Using advanced geometry processing, we bridge the gap between drafting and modeling.',
        features_title: 'Key Features',
        feature_1: 'Instant DWG/DXF to 3D conversion',
        feature_2: 'Intelligent closed-loop detection',
        feature_3: 'Export to FBX/OBJ for AutoCAD & Blender',
        disclaimer: 'This is a demo MVP version.'
      },
      auth: {
        signIn: {
          title: 'Welcome Back',
          subtitle: 'Enter your credentials to access the workspace',
          emailLabel: 'Email Address',
          emailPlaceholder: 'engineer@cadlift.io',
          passwordLabel: 'Password',
          forgot: 'Forgot?',
          submit: 'Sign In',
          submitting: 'Signing in...',
          or: 'Or',
          googleSignIn: 'Continue with Google',
          noAccount: 'New to CADLift?',
          createAccount: 'Create an account',
          failed: 'Sign in failed'
        },
        signUp: {
          title: 'Create Account',
          subtitle: 'Start your 3D journey today',
          nameLabel: 'Full Name',
          namePlaceholder: 'John Doe',
          emailLabel: 'Email Address',
          emailPlaceholder: 'engineer@cadlift.io',
          passwordLabel: 'Password',
          passwordHint: 'Minimum 8 characters',
          submit: 'Get Started',
          submitting: 'Creating account...',
          or: 'Or',
          googleSignUp: 'Sign up with Google',
          hasAccount: 'Already have an account?',
          signIn: 'Sign in',
          failed: 'Registration failed'
        },
        signOut: 'Sign Out'
      },
      profile: {
        title: 'Profile',
        memberSince: 'Member since',
        appVersion: 'App Version',
        localConversions: 'Local Conversions',
        openSource: 'Open Source',
        settings: {
          title: 'Settings',
          appearance: 'Appearance',
          language: 'Language',
          account: 'Account',
          security: 'Security',
          dangerZone: 'Danger Zone',
          system: 'System Resources',
          models: 'AI Models'
        },
        system: {
          title: 'System Resources',
          gpu: 'Detected GPU',
          vram: 'VRAM Allocation',
          vramLimit: 'Max VRAM Limit',
          cpuFallback: 'CPU Fallback',
          lowVram: 'Low VRAM Mode',
          autoDetect: 'Auto-detect Hardware'
        },
        models: {
          title: 'AI Model Management',
          path: 'Models Storage Path',
          autoUpdate: 'Auto-Update Models',
          purge: 'Purge Cache',
          verify: 'Verify Integrity',
          status: 'Status',
          ready: 'Ready',
          missing: 'Missing',
          downloading: 'Downloading...'
        },
        theme: {
          light: 'Light',
          dark: 'Dark'
        },
        actions: {
          editProfile: 'Edit Profile',
          changePassword: 'Change Password',
          twoFactor: 'Two-Factor Auth',
          activeSessions: 'Active Sessions',
          loginHistory: 'Login History',
          deleteData: 'Delete All Data',
          deleteAccount: 'Delete Account'
        },
        modals: {
          editProfile: {
            title: 'Edit Profile',
            displayName: 'Display Name',
            save: 'Save Changes',
            saving: 'Saving...',
            success: 'Profile updated successfully!',
            error: 'Failed to update profile'
          },
          changePassword: {
            title: 'Change Password',
            current: 'Current Password',
            new: 'New Password',
            confirm: 'Confirm Password',
            hint: 'Use at least 8 characters with mixed case and numbers',
            save: 'Update Password',
            saving: 'Updating...',
            success: 'Password changed successfully!',
            mismatch: 'Passwords do not match',
            error: 'Failed to change password'
          },
          sessions: {
            title: 'Active Sessions',
            current: 'Current Session',
            device: 'Device',
            browser: 'Browser',
            location: 'Location',
            lastActive: 'Last Active',
            revokeAll: 'Revoke All Other Sessions'
          },
          loginHistory: {
            title: 'Login History',
            recentLogins: 'Recent Logins',
            success: 'Success',
            failed: 'Failed'
          },
          deleteConfirm: {
            title: 'Are you sure?',
            warning: 'This action cannot be undone. This will permanently delete your data.',
            cancel: 'Cancel',
            confirm: 'Yes, Delete'
          },
          comingSoon: 'Coming Soon',
          twoFactorMessage: 'Two-factor authentication will be available in a future update.'
        }
      },
      footer: {
        brand: {
          description: 'Open-source 3D generation platform. Create models from CAD files, images, or text prompts. 100% locally on your machine.'
        },
        sections: {
          product: 'Product',
          resources: 'Resources',
          company: 'Company'
        },
        links: {
          dashboard: 'Dashboard',
          dwgTo3d: 'DWG/DXF to 3D',
          imageTo3d: 'Image to 3D',
          promptTo3d: 'Prompt to 3D',
          apiDocs: 'API Docs',
          resources: 'Resources',
          faq: 'FAQ',
          community: 'Community',
          about: 'About',
          docs: 'Docs',
          github: 'GitHub',
          contact: 'Contact'
        },
        copyright: 'All rights reserved.',
        madeWith: 'Made with',
        by: 'by'
      },
      viewer: {
        title: '3D Model Viewer',
        download: 'Download',
        screenshot: 'Screenshot',
        screenshotSoon: 'Screenshot feature coming soon!',
        supportedFormats: 'Supported Formats',
        poweredBy: 'Powered by',
        openFullPage: 'Open full screen',
        back: 'Back',
        enterFullscreen: 'Full screen (F)',
        exitFullscreen: 'Exit full screen (F)',
        showChat: 'Show AI chat',
        hideChat: 'Hide AI chat',
        loadingModel: 'Loading model...',
        notReady: 'This model is not available. It may still be processing, or it has no 3D output.',
        showRender: 'Render studio',
        hideRender: 'Hide render studio'
      },
      render: {
        title: 'Render studio',
        hint: 'Frame the shot in the 3D view, then turn it into a photoreal image or video.',
        output: 'Output',
        kind_image: 'Photo',
        kind_video: 'Orbit video',
        kind_construction: 'Construction',
        kindHint_image: 'A photoreal still of the current view. About 20 seconds.',
        kindHint_video: 'A photoreal still, then a short camera orbit video. A few minutes.',
        kindHint_construction: 'A short timelapse from an empty building site to the finished building, from this view. A few minutes.',
        style: 'Lighting',
        style_daylight: 'Daylight',
        style_golden_hour: 'Golden hour',
        style_night: 'Dusk with lights on',
        style_interior: 'Interior',
        style_overcast: 'Overcast',
        details: 'Materials and details (optional)',
        detailsPlaceholder: 'e.g. red brick facade, timber deck, olive trees',
        renderView: 'Render current view',
        sending: 'Capturing view...',
        startedImage: 'Rendering. The photo appears below when ready.',
        startedVideo: 'Rendering. Videos take a few minutes; you can keep working.',
        busyLimit: 'Two renders are running. Wait for one to finish.',
        notReady: 'The 3D model has not loaded yet.',
        stage_photo: 'Rendering photo...',
        stage_site: 'Creating construction site...',
        stage_video: 'Animating video...',
        failed: 'Render failed: {{error}}',
        downloadImage: 'Photo',
        downloadSite: 'Site',
        downloadVideo: 'Video',
        empty: 'No renders yet.',
        kind_world: '3D world',
        kind_object: '3D object',
        kind_sound: 'Ambient sound',
        deriveTitle: 'Create from this photo',
        deriveHint_world: 'An explorable 3D world you can walk through. Takes several minutes.',
        deriveHint_object: 'A textured 3D model of one object in the photo. A few minutes.',
        deriveHint_sound: 'A looping ambient soundscape for the scene. Plays inside the 3D world.',
        objectName: 'Object to turn into 3D',
        objectPlaceholder: 'e.g. sofa, dining table',
        objectCreate: 'Create',
        started_world: 'Building the 3D world. This takes several minutes.',
        started_object: 'Creating the 3D object. This takes a few minutes.',
        started_sound: 'Creating the ambient sound.',
        stage_world: 'Building 3D world...',
        stage_isolate: 'Isolating object...',
        stage_model: 'Modelling in 3D...',
        stage_sound: 'Creating sound...',
        exploreWorld: 'Explore world',
        viewModel: 'View 3D',
        downloadReference: 'Reference',
        downloadWorld: 'World (.spz)',
        downloadCollider: 'Collider',
        downloadPano: 'Panorama',
        downloadModel: '3D model',
        downloadSound: 'Sound',
        delete: 'Delete',
        confirmDelete: 'Delete this {{kind}} and its files? This cannot be undone.'
      },
      world: {
        title: '3D world',
        close: 'Close (Esc)',
        loading: 'Loading world...',
        error: 'Could not load the world: {{error}}',
        controls: 'W A S D: move, Q / E: down / up, drag: look around, Shift: faster',
        soundOn: 'Sound on',
        soundOff: 'Mute'
      },
      about: {
        badge: 'Free & Open Source Software',
        hero: {
          title1: 'The',
          titleHighlight: 'Open Source',
          title2: '3D Engine',
          subtitle: 'CADLift is a 100% free and open-source platform that runs locally on your machine. No cloud subscriptions, no data tracking.'
        },
        workflows: {
          title: 'Three Ways to Create 3D',
          subtitle: 'Choose the workflow that fits your needs.',
          dwg: {
            title: 'DWG/DXF to 3D',
            description: 'Upload AutoCAD files (DWG or DXF) and we extrude closed shapes into 3D models locally.'
          },
          image: {
            title: 'Image to 3D',
            description: 'Transform any 2D image into a detailed 3D model using local AI models.'
          },
          prompt: {
            title: 'Prompt to 3D',
            description: 'Describe your idea in text. Stable Diffusion generates an image, then TripoSR builds your 3D model offline.'
          }
        },
        features: {
          title: 'Plus These Features',
          viewer: 'Built-in 3D Viewer',
          export: 'GLB, STL, DXF, STEP Export',
          realtime: 'Real-Time Progress',
          local: '100% Local Processing'
        },
        tech: {
          title: 'Built With',
          subtitle: 'Powered by modern open-source technologies.',
          frontend: 'Frontend',
          backend: 'Backend',
          ai: 'AI Models',
          cad: 'CAD Tools'
        },
        cta: {
          title: 'Ready to Contribute?',
          subtitle: 'Join us on GitHub to shape the future of open-source CAD tools.',
          button: 'View on GitHub'
        },
        disclaimer: 'CADLift is an open-source project. Models run locally on your GPU.'
      }
    }
  },
  de: {
    translation: {
      common: {
        title: 'CADLift',
        home: 'Startseite',
        about: 'Über uns',
        theme_dark: 'Dunkelmodus',
        theme_light: 'Hellmodus',
        footer_text: '(c) 2026 CADLift. Alle Rechte vorbehalten.',
        footer_made: 'Mit Liebe entwickelt von',
        footer_docs: 'Dokumentation',
        footer_support: 'Support',
        footer_github: 'GitHub',
        convert: 'In 3D umwandeln',
        upload_title: 'DXF- oder PDF-Datei hochladen',
        upload_drag: 'DXF-, DWG- oder PDF-Plan hier ablegen oder klicken zum Auswählen',
        upload_hint: 'Max. Dateigröße: 50MB. Unterstützte Formate: .dxf, .dwg, .pdf (Vektor)',
        mode_label: 'Konvertierungsmodus',
        unit_label: 'Einheit',
        height_label: 'Extrusionshöhe',
        upload_invalid_format: 'Ungültiges Dateiformat. Nur .dxf-, .dwg- und .pdf-Dateien werden unterstützt.',
        upload_too_large: 'Datei zu groß (max. 50MB).',
        plan_width_label: 'Planbreite (m)',
        plan_width_hint: 'Reale Breite der gezeichneten Geschossfläche. Leer lassen, um sie aus Arbeitsplatzsymbolen zu schätzen.',
        viewer_fly_on: 'Flugmodus: an',
        viewer_fly_off: 'Flugmodus: aus',
        viewer_controls_title: 'Steuerung',
        viewer_controls_rotate: 'Links ziehen: drehen',
        viewer_controls_pan: 'Rechts ziehen: verschieben',
        viewer_controls_zoom: 'Scrollen: zoomen',
        viewer_controls_fly: 'W A S D: fliegen, Q / E: runter / hoch, Shift: schneller',
        viewer_loading: '3D-Modell wird geladen...',
        viewer_error: '3D-Modell konnte nicht geladen werden',
        plan_chat_title: 'Mit KI bearbeiten',
        plan_chat_hint: 'Beschreiben Sie Änderungen an Farben, Höhen oder Sichtbarkeit. Änderungen gelten für ganze Ebenen.',
        plan_chat_placeholder: 'z. B. alle Möbel in warmem Holz',
        plan_chat_send: 'Senden',
        plan_chat_undo: 'Rückgängig',
        plan_chat_busy: 'Modell wird aktualisiert...',
        plan_chat_layers: 'Ebenen ({{count}})',
        plan_chat_hidden: 'ausgeblendet',
        plan_chat_floor: 'Boden',
        plan_chat_skipped: 'Nicht angewendet: {{items}}',
        plan_chat_you: 'Sie',
        plan_chat_ai: 'KI',
        plan_chat_suggestion_1: 'Alle Möbel in warmem Holz',
        plan_chat_suggestion_2: 'Boden dunkelgrauer Beton',
        plan_chat_suggestion_3: 'Grüne Möbel als 1,2 m hohe blattgrüne Pflanzen',
        plan_chat_suggestion_4: 'Wände gebrochenes Weiß und 2,8 m hoch',
        mode_floor: 'Grundriss (Wände)',
        mode_mech: 'Mechanisches Teil',
        status_pending: 'Ausstehend...',
        status_processing: 'Geometrie wird verarbeitet...',
        status_completed: 'Konvertierung abgeschlossen!',
        status_failed: 'Konvertierung fehlgeschlagen',
        status_queued: 'In Warteschlange',
        status_cancelled: 'Abgebrochen',
        download_btn: '3D-Modell herunterladen',
        start_new: 'Weitere Datei konvertieren',
        processing_step_1: 'DXF wird analysiert...',
        processing_step_2: 'Geometrie wird extrudiert...',
        processing_step_3: 'STEP-Datei wird generiert...'
      },
      navigation: {
        dashboard: 'Dashboard',
        dashboard_btn: 'Zum Dashboard',
        projects: 'Meine Projekte',
        docs: 'Dokumentation',
        resources: 'Ressourcen',
        about: 'Über uns',
        viewOnGithub: 'Auf GitHub ansehen'
      },
      home: {
        hero: {
          badge: 'KI-gestützte 3D-Generierung',
          title1: 'Verwandle',
          title2: 'Alles',
          title3: 'in',
          title4: '3D',
          subtitle: 'Von',
          subtitleCad: 'CAD-Dateien',
          subtitleTo: 'über',
          subtitleImages: 'Bilder',
          subtitlePrompts: 'Text-Prompts',
          subtitleEnd: '— generieren Sie produktionsreife 3D-Modelle in Sekunden.',
          primaryCta: 'Jetzt erstellen',
          secondaryCta: 'Funktionen entdecken',
          inputTypes: {
            dwg: 'DWG / DXF',
            images: 'Bilder',
            prompts: 'KI-Prompts'
          }
        },
        features: {
          badge: 'Leistungsstarke Funktionen',
          title: 'Drei Wege zum',
          titleAccent: 'Erstellen',
          subtitle: 'Wählen Sie Ihre Eingabemethode. Wir erledigen den Rest.',
          cad: {
            title: 'DWG/DXF zu 3D',
            description: 'Laden Sie AutoCAD-Dateien direkt hoch. Wir erkennen automatisch Ebenen, Wände und Formen — und extrudieren zu 3D-Modellen.',
            features: ['Native DWG-Unterstützung via ODA', 'Alle DXF-Versionen', 'Automatische Ebenenerkennung', 'Geschlossene Form-Extrusion']
          },
          image: {
            title: 'Bild zu 3D',
            description: 'Laden Sie beliebige Bilder hoch — Fotos, Skizzen, Render. Unsere KI rekonstruiert sie in 3D mit TripoSR.'
          },
          prompt: {
            title: 'Prompt zu 3D',
            description: 'Einfach beschreiben. Stable Diffusion generiert ein Bild, dann erstellt TripoSR Ihr 3D-Modell.'
          },
          viewer: {
            title: '3D-Viewer',
            description: 'Vorschau vor dem Download'
          },
          export: {
            title: 'Multi-Format',
            description: 'GLB, STL, DXF, STEP'
          }
        },
        howItWorks: {
          title: 'So',
          titleAccent: 'funktioniert es',
          subtitle: 'Drei einfache Schritte zu 3D',
          steps: [
            { title: 'Hochladen oder Beschreiben', description: 'CAD-Datei, Bild oder Prompt eingeben' },
            { title: 'KI-Verarbeitung', description: 'Unsere Engines erkennen Geometrie und generieren 3D' },
            { title: 'Ansehen & Herunterladen', description: 'Im 3D-Viewer prüfen, in jedem Format exportieren' }
          ]
        },
        cta: {
          badge: 'Kostenlos starten',
          title: 'Bereit zum',
          titleAccent: 'Erstellen',
          subtitle: 'Verwandeln Sie CAD-Dateien, Bilder oder Ideen in 3D-Modelle. Keine Kreditkarte erforderlich.',
          button: 'Dashboard öffnen'
        }
      },
      resourcesPage: {
        heading: 'Lernen & Erstellen',
        subheading: 'Erkunden Sie unsere Dokumentation, Tutorials und Community-Ressourcen.',
        cards: {
          docs: {
            title: 'API-Dokumentation',
            desc: 'Vollständige API-Referenz für die Integration von CADLift in Ihre Anwendungen.'
          },
          videos: {
            title: 'Video-Tutorials',
            desc: 'Schritt-für-Schritt-Anleitungen für häufige Arbeitsabläufe und Anwendungsfälle.'
          },
          faq: {
            title: 'FAQ',
            desc: 'Antworten auf häufig gestellte Fragen zur 3D-Konvertierung.'
          },
          community: {
            title: 'Community',
            desc: 'Treten Sie unserer Community bei, um Hilfe zu erhalten und Ihre Projekte zu teilen.'
          }
        }
      },
      dashboard: {
        hero: {
          greeting: 'Willkommen zurück',
          newUser: 'Willkommen bei CADLift',
          tagline: 'Ihr 3D-Kreativstudio',
          quickAction: 'Schnellaktion',
          createNew: 'Neu erstellen',
          viewProjects: 'Projekte ansehen',
          stats: {
            conversions: 'Konvertierungen',
            thisWeek: 'Diese Woche',
            successRate: 'Erfolgsrate',
            avgTime: 'Durchschn. Zeit'
          },
          emptyState: {
            title: 'Bereit zu erstellen?',
            subtitle: 'Wählen Sie unten einen Arbeitsablauf, um Ihr erstes 3D-Modell zu starten'
          },
          signedInAs: 'Angemeldet als',
          signOut: 'Abmelden'
        },
        modes: {
          title: 'Konvertierungsmodi',
          subtitle: 'Wählen Sie den Arbeitsablauf, der zu Ihrer Eingabe passt. Sprache und Design werden automatisch übernommen.',
          cad: {
            title: 'AutoCAD 2D → 3D Konvertierung',
            description: 'Laden Sie DXF/DWG-Zeichnungen hoch und extrudieren Sie automatisch saubere architektonische oder mechanische Körper.',
            badge: 'DXF / DWG',
            cta: 'CAD-Datei hochladen'
          },
          image: {
            title: 'Bild zu 2D/3D Generator',
            description: 'Verwandeln Sie Skizzen, Grundrisse oder Produktfotos in CAD-fertige Referenzen.',
            optionsLabel: 'Verfügbare Ausgaben',
            option2d: 'Vektor 2D-Plan',
            option3d: 'Wasserdichtes 3D-Mesh',
            cta: 'Bild hochladen'
          },
          prompt: {
            title: 'Text-Prompt zu 2D/3D',
            description: 'Beschreiben Sie, was Sie brauchen, und lassen Sie CADLift die Geometrie automatisch erstellen.',
            examplesLabel: 'Prompt-Ideen',
            exampleOne: 'Zeichne einen 3x4m Raum mit einem Südfenster.',
            exampleTwo: 'Erzeuge einen leichten L-Winkel mit zwei M6-Bohrungen.',
            cta: 'Prompt-Generierung starten'
          },
          comingSoon: 'Demnächst',
          betaLabel: 'Beta'
        },
        recent: {
          title: 'Letzte Aktivität',
          subtitle: 'Verfolgen Sie vergangene Aufträge, laden Sie Ergebnisse herunter oder wiederholen Sie fehlgeschlagene Jobs.',
          empty: 'Noch keine Jobs. Starten Sie eine Konvertierung, um diese Zeitleiste zu füllen.',
          table: {
            type: 'Job-Typ',
            input: 'Eingabe',
            output: 'Ausgabe',
            status: 'Status',
            created: 'Erstellt',
            actions: 'Aktionen'
          },
          action: {
            view: 'Ansehen',
            download: 'Herunterladen',
            retry: 'Wiederholen'
          },
          time_two_hours: 'Vor 2 Stunden',
          time_ten_minutes: 'Vor 10 Minuten',
          time_yesterday: 'Gestern',
          time_just_now: 'Gerade eben'
        },
        quickLinks: {
          title: 'Ressourcen',
          subtitle: 'Anleitungen, Dokumentation und Support für Ihren Fortschritt.',
          documentation: {
            title: 'Dokumentation',
            description: 'REST-Endpunkte, Webhooks und Payload-Schemas.'
          },
          tutorials: {
            title: 'Tutorial-Videos',
            description: 'Schritt-für-Schritt-Anleitungen auf EN und DE.'
          },
          faq: {
            title: 'FAQ',
            description: 'Limits, unterstützte Formate und Fehlerbehebung.'
          },
          support: {
            title: 'Community & Support',
            description: 'Treten Sie dem Forum bei oder eröffnen Sie ein Support-Ticket.'
          }
        },
        workspace: {
          title: 'Konvertierungs-Arbeitsbereich',
          subtitle: 'Laden Sie eine DXF hoch, legen Sie Extrusionsparameter fest und verfolgen Sie den Fortschritt in Echtzeit.',
          statusReady: 'System bereit. Warte auf Eingabe...'
        },
        quickStart: {
          title: 'Schnellstart',
          description: 'Starten Sie einen Arbeitsablauf mit einem Klick oder nutzen Sie Tastenkürzel.',
          actions: {
            uploadCad: 'CAD hochladen',
            uploadImage: 'Bild hochladen',
            startPrompt: 'Prompt starten'
          }
        },
        tips: {
          title: 'Onboarding-Tipps',
          upload: 'Laden Sie eine CAD-Datei hoch, um die klassische 2D → 3D Extrusion zu starten.',
          prompt: 'Probieren Sie den Prompt-Generator für textbasierte Erkundungen.',
          dismiss: 'Verstanden'
        },
        imageForm: {
          title: 'Bild zu CAD Arbeitsablauf',
          description: 'Verwandeln Sie Skizzen, Scans oder Produktfotos in Vektorpläne oder Meshes.',
          uploadLabel: 'Bild ablegen oder durchsuchen',
          uploadHint: 'Unterstützt: PNG, JPG, SVG bis 25MB',
          pickButton: 'Bild auswählen',
          option2d: {
            title: 'Vektor 2D-Ausgabe',
            desc: 'Erzeugt saubere DXF-Kurven und Ebenen.'
          },
          option3d: {
            title: '3D-Mesh-Ausgabe',
            desc: 'Erstellt wasserdichte Meshes für CAD-Apps.'
          },
          notesLabel: 'Notizen',
          notesPlaceholder: 'Geben Sie Informationen zu Maßstab, Einheiten oder gewünschtem Detailgrad an.',
          submit: 'Aus Bild generieren',
          submitLoading: 'Bild wird verarbeitet...',
          errors: {
            unsupported: 'Nicht unterstützter Dateityp. Bitte PNG/JPG/SVG verwenden.',
            tooLarge: 'Bild überschreitet 25MB-Limit.',
            required: 'Bitte fügen Sie ein Bild hinzu, um fortzufahren.'
          }
        },
        promptForm: {
          title: 'Prompt zu Geometrie',
          description: 'Beschreiben Sie den Raum oder das Teil. CADLift erstellt Schleifen und Körper.',
          promptLabel: 'Was sollen wir zeichnen?',
          placeholder: 'z.B. Zylindrischer Adapter mit 50mm Durchmesser und zwei Schraubenmustern...',
          option2d: {
            title: '2D-Entwurf',
            desc: 'Gibt DXF-Linien und -Bögen zur Überprüfung aus.'
          },
          option3d: {
            title: '3D-Konzept',
            desc: 'Gibt leichte STEP-Meshes aus.'
          },
          detailLabel: 'Detailstufe',
          detailLow: 'Grob',
          detailHigh: 'Präzise',
          submit: 'Objekt generieren',
          submitLoading: 'Wird generiert...',
          errors: {
            required: 'Bitte beschreiben Sie, was Sie benötigen.'
          }
        }
      },
      auth: {
        signIn: {
          title: 'Willkommen zurück',
          subtitle: 'Geben Sie Ihre Anmeldedaten ein',
          emailLabel: 'E-Mail-Adresse',
          emailPlaceholder: 'ingenieur@cadlift.io',
          passwordLabel: 'Passwort',
          forgot: 'Vergessen?',
          submit: 'Anmelden',
          submitting: 'Wird angemeldet...',
          or: 'Oder',
          googleSignIn: 'Mit Google fortfahren',
          noAccount: 'Neu bei CADLift?',
          createAccount: 'Konto erstellen',
          failed: 'Anmeldung fehlgeschlagen'
        },
        signUp: {
          title: 'Konto erstellen',
          subtitle: 'Starten Sie noch heute Ihre 3D-Reise',
          nameLabel: 'Vollständiger Name',
          namePlaceholder: 'Max Mustermann',
          emailLabel: 'E-Mail-Adresse',
          emailPlaceholder: 'ingenieur@cadlift.io',
          passwordLabel: 'Passwort',
          passwordHint: 'Mindestens 8 Zeichen',
          submit: 'Loslegen',
          submitting: 'Konto wird erstellt...',
          or: 'Oder',
          googleSignUp: 'Mit Google registrieren',
          hasAccount: 'Bereits ein Konto?',
          signIn: 'Anmelden',
          failed: 'Registrierung fehlgeschlagen'
        },
        signOut: 'Abmelden'
      },
      profile: {
        title: 'Ihr Profil',
        memberSince: 'Mitglied seit',
        appVersion: 'App-Version',
        localConversions: 'Lokale Konvertierungen',
        openSource: 'Open Source',
        settings: {
          title: 'Einstellungen',
          appearance: 'Erscheinungsbild',
          language: 'Sprache',
          account: 'Konto',
          security: 'Sicherheit',
          dangerZone: 'Gefahrenzone',
          system: 'Systemressourcen',
          models: 'KI-Modelle'
        },
        system: {
          title: 'Systemressourcen',
          gpu: 'Erkannte GPU',
          vram: 'VRAM-Zuweisung',
          vramLimit: 'Max. VRAM-Limit',
          cpuFallback: 'CPU-Fallback',
          lowVram: 'Niedriger VRAM-Modus',
          autoDetect: 'Hardware automatisch erkennen'
        },
        models: {
          title: 'KI-Modellverwaltung',
          path: 'Modellspeicherpfad',
          autoUpdate: 'Modelle automatisch aktualisieren',
          purge: 'Cache leeren',
          verify: 'Integrität prüfen',
          status: 'Status',
          ready: 'Bereit',
          missing: 'Fehlt',
          downloading: 'Wird heruntergeladen...'
        },
        theme: {
          light: 'Hell',
          dark: 'Dunkel'
        },
        actions: {
          editProfile: 'Profil bearbeiten',
          changePassword: 'Passwort ändern',
          twoFactor: 'Zwei-Faktor-Authentifizierung',
          activeSessions: 'Aktive Sitzungen',
          loginHistory: 'Anmeldeverlauf',
          deleteData: 'Alle Daten löschen',
          deleteAccount: 'Konto löschen'
        },
        modals: {
          editProfile: {
            title: 'Profil bearbeiten',
            displayName: 'Anzeigename',
            save: 'Änderungen speichern',
            saving: 'Wird gespeichert...',
            success: 'Profil erfolgreich aktualisiert!',
            error: 'Profil konnte nicht aktualisiert werden'
          },
          changePassword: {
            title: 'Passwort ändern',
            current: 'Aktuelles Passwort',
            new: 'Neues Passwort',
            confirm: 'Passwort bestätigen',
            hint: 'Mindestens 8 Zeichen mit Groß-/Kleinbuchstaben und Zahlen',
            save: 'Passwort aktualisieren',
            saving: 'Wird aktualisiert...',
            success: 'Passwort erfolgreich geändert!',
            mismatch: 'Passwörter stimmen nicht überein',
            error: 'Passwort konnte nicht geändert werden'
          },
          sessions: {
            title: 'Aktive Sitzungen',
            current: 'Aktuelle Sitzung',
            device: 'Gerät',
            browser: 'Browser',
            location: 'Standort',
            lastActive: 'Letzte Aktivität',
            revokeAll: 'Alle anderen Sitzungen widerrufen'
          },
          loginHistory: {
            title: 'Anmeldeverlauf',
            recentLogins: 'Letzte Anmeldungen',
            success: 'Erfolgreich',
            failed: 'Fehlgeschlagen'
          },
          deleteConfirm: {
            title: 'Sind Sie sicher?',
            warning: 'Diese Aktion kann nicht rückgängig gemacht werden. Ihre Daten werden dauerhaft gelöscht.',
            cancel: 'Abbrechen',
            confirm: 'Ja, löschen'
          },
          comingSoon: 'Demnächst',
          twoFactorMessage: 'Die Zwei-Faktor-Authentifizierung wird in einem zukünftigen Update verfügbar sein.'
        }
      },
      footer: {
        brand: {
          description: 'Open-Source-Plattform für 3D-Generierung. Erstellen Sie Modelle aus CAD-Dateien, Bildern oder Textbefehlen. 100% lokal auf Ihrem Rechner.'
        },
        sections: {
          product: 'Produkt',
          resources: 'Ressourcen',
          company: 'Unternehmen'
        },
        links: {
          dashboard: 'Dashboard',
          dwgTo3d: 'DWG/DXF zu 3D',
          imageTo3d: 'Bild zu 3D',
          promptTo3d: 'Prompt zu 3D',
          apiDocs: 'API-Dokumentation',
          resources: 'Ressourcen',
          faq: 'FAQ',
          community: 'Community',
          about: 'Über uns',
          docs: 'Dokumentation',
          github: 'GitHub',
          contact: 'Kontakt'
        },
        copyright: 'Alle Rechte vorbehalten.',
        madeWith: 'Entwickelt mit',
        by: 'von'
      },
      viewer: {
        title: '3D-Modell-Viewer',
        download: 'Herunterladen',
        screenshot: 'Screenshot',
        screenshotSoon: 'Screenshot-Funktion kommt bald!',
        supportedFormats: 'Unterstützte Formate',
        poweredBy: 'Bereitgestellt von',
        openFullPage: 'Vollbild öffnen',
        back: 'Zurück',
        enterFullscreen: 'Vollbild (F)',
        exitFullscreen: 'Vollbild beenden (F)',
        showChat: 'KI-Chat anzeigen',
        hideChat: 'KI-Chat ausblenden',
        loadingModel: 'Modell wird geladen...',
        notReady: 'Dieses Modell ist nicht verfügbar. Es wird eventuell noch verarbeitet oder hat keine 3D-Ausgabe.',
        showRender: 'Render-Studio',
        hideRender: 'Render-Studio ausblenden'
      },
      render: {
        title: 'Render-Studio',
        hint: 'Wählen Sie den Ausschnitt in der 3D-Ansicht und machen Sie daraus ein fotorealistisches Bild oder Video.',
        output: 'Ausgabe',
        kind_image: 'Foto',
        kind_video: 'Kamerafahrt',
        kind_construction: 'Bauablauf',
        kindHint_image: 'Ein fotorealistisches Standbild der aktuellen Ansicht. Etwa 20 Sekunden.',
        kindHint_video: 'Ein fotorealistisches Standbild, dann ein kurzes Video mit Kamerafahrt. Einige Minuten.',
        kindHint_construction: 'Ein kurzer Zeitraffer von der leeren Baustelle bis zum fertigen Gebäude aus dieser Ansicht. Einige Minuten.',
        style: 'Beleuchtung',
        style_daylight: 'Tageslicht',
        style_golden_hour: 'Goldene Stunde',
        style_night: 'Dämmerung mit Licht',
        style_interior: 'Innenraum',
        style_overcast: 'Bewölkt',
        details: 'Materialien und Details (optional)',
        detailsPlaceholder: 'z. B. Klinkerfassade, Holzterrasse, Olivenbäume',
        renderView: 'Aktuelle Ansicht rendern',
        sending: 'Ansicht wird erfasst...',
        startedImage: 'Wird gerendert. Das Foto erscheint unten, sobald es fertig ist.',
        startedVideo: 'Wird gerendert. Videos dauern einige Minuten; Sie können weiterarbeiten.',
        busyLimit: 'Zwei Renderings laufen bereits. Warten Sie, bis eines fertig ist.',
        notReady: 'Das 3D-Modell ist noch nicht geladen.',
        stage_photo: 'Foto wird gerendert...',
        stage_site: 'Baustelle wird erstellt...',
        stage_video: 'Video wird animiert...',
        failed: 'Rendering fehlgeschlagen: {{error}}',
        downloadImage: 'Foto',
        downloadSite: 'Baustelle',
        downloadVideo: 'Video',
        empty: 'Noch keine Renderings.',
        kind_world: '3D-Welt',
        kind_object: '3D-Objekt',
        kind_sound: 'Umgebungsklang',
        deriveTitle: 'Aus diesem Foto erstellen',
        deriveHint_world: 'Eine begehbare 3D-Welt. Dauert mehrere Minuten.',
        deriveHint_object: 'Ein texturiertes 3D-Modell eines Objekts im Foto. Einige Minuten.',
        deriveHint_sound: 'Eine Klangkulisse in Schleife für die Szene. Läuft auch in der 3D-Welt.',
        objectName: 'Objekt für 3D',
        objectPlaceholder: 'z. B. Sofa, Esstisch',
        objectCreate: 'Erstellen',
        started_world: 'Die 3D-Welt wird erstellt. Das dauert mehrere Minuten.',
        started_object: 'Das 3D-Objekt wird erstellt. Das dauert einige Minuten.',
        started_sound: 'Der Umgebungsklang wird erstellt.',
        stage_world: '3D-Welt wird erstellt...',
        stage_isolate: 'Objekt wird freigestellt...',
        stage_model: '3D-Modell wird erstellt...',
        stage_sound: 'Klang wird erstellt...',
        exploreWorld: 'Welt erkunden',
        viewModel: '3D ansehen',
        downloadReference: 'Referenz',
        downloadWorld: 'Welt (.spz)',
        downloadCollider: 'Kollision',
        downloadPano: 'Panorama',
        downloadModel: '3D-Modell',
        downloadSound: 'Klang',
        delete: 'Löschen',
        confirmDelete: '{{kind}} und zugehörige Dateien löschen? Das kann nicht rückgängig gemacht werden.'
      },
      world: {
        title: '3D-Welt',
        close: 'Schließen (Esc)',
        loading: 'Welt wird geladen...',
        error: 'Welt konnte nicht geladen werden: {{error}}',
        controls: 'W A S D: bewegen, Q / E: runter / hoch, Ziehen: umsehen, Shift: schneller',
        soundOn: 'Ton an',
        soundOff: 'Stumm'
      },
      about: {
        badge: 'KI-gestützte 3D-Generierung',
        hero: {
          title1: 'Verwandle',
          titleHighlight: 'Alles',
          title2: 'in 3D',
          subtitle: 'CADLift ist eine Open-Source-Plattform, die CAD-Dateien, Bilder und Textbefehle mithilfe von KI in produktionsreife 3D-Modelle konvertiert.'
        },
        workflows: {
          title: 'Drei Wege zu 3D',
          subtitle: 'Wählen Sie den Arbeitsablauf, der zu Ihren Anforderungen passt.',
          dwg: {
            title: 'DWG/DXF zu 3D',
            description: 'Laden Sie AutoCAD-Dateien hoch und wir extrudieren geschlossene Formen zu 3D-Modellen.'
          },
          image: {
            title: 'Bild zu 3D',
            description: 'Verwandeln Sie jedes 2D-Bild mit TripoSR-KI in ein detailliertes 3D-Modell.'
          },
          prompt: {
            title: 'Prompt zu 3D',
            description: 'Beschreiben Sie Ihre Idee in Text. Unsere KI generiert ein Bild und konvertiert es zu 3D.'
          }
        },
        features: {
          title: 'Zusätzliche Funktionen',
          viewer: 'Integrierter 3D-Viewer',
          export: 'GLB, STL, DXF, STEP Export',
          realtime: 'Echtzeit-Fortschritt',
          local: 'Lokale Verarbeitung'
        },
        tech: {
          title: 'Technologie-Stack',
          subtitle: 'Moderne Open-Source-Technologien.',
          frontend: 'Frontend',
          backend: 'Backend',
          ai: 'KI-Modelle',
          cad: 'CAD-Tools'
        },
        cta: {
          title: 'Bereit zum Ausprobieren?',
          subtitle: 'Starten Sie jetzt mit der Generierung von 3D-Modellen aus CAD-Dateien, Bildern oder Textbefehlen.',
          button: 'Dashboard öffnen'
        },
        disclaimer: 'CADLift ist ein Open-Source-Projekt. KI-Funktionen erfordern beim ersten Gebrauch einen Modell-Download.'
      }
    }
  }
};

const initialLanguage = getInitialLanguage();

i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false
  }
});

if (typeof window !== 'undefined') {
  i18n.on('languageChanged', (lng) => {
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
    } catch {
      // ignore storage errors
    }
  });
}

export default i18n;
