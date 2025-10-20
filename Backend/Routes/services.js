const express = require('express');
const { authenticateAndTrack } = require('../Middleware/usageTracker');

const router = express.Router();

// Example GET route
// This can be expanded with more service-related endpoints
router.get('/istruecalleravailable', (req, res) => {
    console.log('Truecaller availability check requested');
    res.status(200).json({ message: 'Truecaller is available' });
});

// ============================================
// GUIDE VIDEOS ENDPOINTS
// ============================================

/**
 * Hardcoded guide videos data
 * Real video data from YouTube with Hindi and Hinglish translations
 */
const guideVideos = [
    {
        id: "1",
        videoId: {
            en: "98BvmZbxpIk",
            hi: "98BvmZbxpIk",
            hing: "98BvmZbxpIk"
        },
        title: {
            en: "Site Haazri App Introduction",
            hi: "साइट हाज़री ऐप का परिचय",
            hing: "Site Haazri app ka introduction"
        },
        description: {
            en: "Introduction to Site Haazri - Digital solution for construction site management",
            hi: "साइट हाज़री का परिचय - निर्माण साइट मैनेजमेंट के लिए डिजिटल समाधान",
            hing: "Site Haazri ka introduction - Construction site management ke liye digital solution"
        },
        duration: "0:45",
        category: "basics",
        thumbnail: "https://img.youtube.com/vi/98BvmZbxpIk/maxresdefault.jpg",
        order: 1,
        isActive: true,
        views: 0,
        likes: 0,
        relatedVideos: ["2", "3"],
        tags: ["introduction", "basics", "getting-started"],
        createdAt: "2025-10-17T00:00:00Z",
        updatedAt: "2025-10-17T00:00:00Z"
    },
    {
        id: "2",
        videoId: {
            en: "C5ro__cTRPo",
            hi: "C5ro__cTRPo",
            hing: "C5ro__cTRPo"
        },
        title: {
            en: "How to Add a New Site",
            hi: "नई साइट कैसे बनाएं",
            hing: "Nayi site kaise banaye"
        },
        description: {
            en: "Learn how to login and add your first site in the app",
            hi: "लॉगिन करना और अपनी पहली साइट बनाना सीखें",
            hing: "Login karna aur apni pehli site banana seekhe"
        },
        duration: "1:36",
        category: "sites",
        thumbnail: "https://img.youtube.com/vi/C5ro__cTRPo/maxresdefault.jpg",
        order: 2,
        isActive: true,
        views: 0,
        likes: 0,
        relatedVideos: ["1", "3"],
        tags: ["site", "add-site", "login"],
        createdAt: "2025-10-17T00:00:00Z",
        updatedAt: "2025-10-17T00:00:00Z"
    },
    {
        id: "3",
        videoId: {
            en: "zQ-QYP8en3k",
            hi: "zQ-QYP8en3k",
            hing: "zQ-QYP8en3k"
        },
        title: {
            en: "How to Add Labour",
            hi: "मजदूर कैसे जोड़ें",
            hing: "Mazdoor kaise jode"
        },
        description: {
            en: "Step-by-step guide to add your first labour in the site",
            hi: "साइट में अपना पहला मजदूर जोड़ने की पूरी जानकारी",
            hing: "Site mein apna pehla mazdoor jodne ki poori jaankari"
        },
        duration: "1:02",
        category: "employees",
        thumbnail: "https://img.youtube.com/vi/zQ-QYP8en3k/maxresdefault.jpg",
        order: 3,
        isActive: true,
        views: 0,
        likes: 0,
        relatedVideos: ["2", "4"],
        tags: ["labour", "employee", "add-worker"],
        createdAt: "2025-10-17T00:00:00Z",
        updatedAt: "2025-10-17T00:00:00Z"
    },
    {
        id: "4",
        videoId: {
            en: "0gYaQ5BGf00",
            hi: "0gYaQ5BGf00",
            hing: "0gYaQ5BGf00"
        },
        title: {
            en: "How to Mark Attendance",
            hi: "हाजिरी कैसे लगाएं",
            hing: "Haazri kaise lagaye"
        },
        description: {
            en: "Learn how to mark daily attendance of labours in your site",
            hi: "अपनी साइट के मजदूरों की रोज की हाजिरी लगाना सीखें",
            hing: "Apni site ke mazdooro ki roz ki haazri lagana seekhe"
        },
        duration: "2:17",
        category: "attendance",
        thumbnail: "https://img.youtube.com/vi/0gYaQ5BGf00/maxresdefault.jpg",
        order: 4,
        isActive: true,
        views: 0,
        likes: 0,
        relatedVideos: ["3", "5"],
        tags: ["attendance", "haazri", "mark-attendance"],
        createdAt: "2025-10-17T00:00:00Z",
        updatedAt: "2025-10-17T00:00:00Z"
    },
    {
        id: "5",
        videoId: {
            en: "ZoloU-ghrdg",
            hi: "ZoloU-ghrdg",
            hing: "ZoloU-ghrdg"
        },
        title: {
            en: "How to Add Advance Payment",
            hi: "एडवांस पेमेंट कैसे जोड़ें",
            hing: "Advance payment kaise jode"
        },
        description: {
            en: "Add advance payment details that labour has taken from you",
            hi: "मजदूर ने जो एडवांस लिया है वो कैसे जोड़ें",
            hing: "Mazdoor ne jo advance liya hai wo kaise jode"
        },
        duration: "1:25",
        category: "payment",
        thumbnail: "https://img.youtube.com/vi/ZoloU-ghrdg/maxresdefault.jpg",
        order: 5,
        isActive: true,
        views: 0,
        likes: 0,
        relatedVideos: ["4", "6"],
        tags: ["payment", "advance", "payout"],
        createdAt: "2025-10-17T00:00:00Z",
        updatedAt: "2025-10-17T00:00:00Z"
    },
    {
        id: "6",
        videoId: {
            en: "sefA7r0wngw",
            hi: "sefA7r0wngw",
            hing: "sefA7r0wngw"
        },
        title: {
            en: "View Final Labour Payment in One Click",
            hi: "एक क्लिक में मजदूर का फाइनल पेमेंट देखें",
            hing: "Ek click mein mazdoor ka final payment dekhe"
        },
        description: {
            en: "No calculation needed - view final labour payment in one click",
            hi: "कोई गणना नहीं - एक क्लिक में फाइनल पेमेंट देखें",
            hing: "Koi calculation nahi - ek click mein final payment dekhe"
        },
        duration: "3:14",
        category: "payment",
        thumbnail: "https://img.youtube.com/vi/sefA7r0wngw/maxresdefault.jpg",
        order: 6,
        isActive: true,
        views: 0,
        likes: 0,
        relatedVideos: ["5", "7"],
        tags: ["payment", "salary", "final-payment"],
        createdAt: "2025-10-17T00:00:00Z",
        updatedAt: "2025-10-17T00:00:00Z"
    },
    {
        id: "7",
        videoId: {
            en: "n2jxMQlmERc",
            hi: "n2jxMQlmERc",
            hing: "n2jxMQlmERc"
        },
        title: {
            en: "How to Edit Labour Details",
            hi: "मजदूर की जानकारी कैसे बदलें",
            hing: "Mazdoor ki jaankari kaise badle"
        },
        description: {
            en: "Learn how to edit or correct any labour details in the app",
            hi: "ऐप में किसी भी मजदूर की जानकारी कैसे बदलें या सही करें",
            hing: "App mein kisi bhi mazdoor ki jaankari kaise badle ya sahi kare"
        },
        duration: "1:40",
        category: "employees",
        thumbnail: "https://img.youtube.com/vi/n2jxMQlmERc/maxresdefault.jpg",
        order: 7,
        isActive: true,
        views: 0,
        likes: 0,
        relatedVideos: ["3", "8"],
        tags: ["edit", "labour", "update-details"],
        createdAt: "2025-10-17T00:00:00Z",
        updatedAt: "2025-10-17T00:00:00Z"
    },
    {
        id: "8",
        videoId: {
            en: "CvcQJBrbMP8",
            hi: "CvcQJBrbMP8",
            hing: "CvcQJBrbMP8"
        },
        title: {
            en: "How to View and Add Site Expenses",
            hi: "साइट का खर्चा कैसे देखें और जोड़ें",
            hing: "Site ka kharcha kaise dekhe aur jode"
        },
        description: {
            en: "Learn how to add and view all site expenses in the app",
            hi: "ऐप में साइट के सभी खर्चे कैसे देखें और जोड़ें",
            hing: "App mein site ke sabhi kharche kaise dekhe aur jode"
        },
        duration: "4:04",
        category: "reports",
        thumbnail: "https://img.youtube.com/vi/CvcQJBrbMP8/maxresdefault.jpg",
        order: 8,
        isActive: true,
        views: 0,
        likes: 0,
        relatedVideos: ["6", "9"],
        tags: ["expenses", "site-expenses", "kharcha"],
        createdAt: "2025-10-17T00:00:00Z",
        updatedAt: "2025-10-17T00:00:00Z"
    },
    {
        id: "9",
        videoId: {
            en: "zodoYA5QR8E",
            hi: "zodoYA5QR8E",
            hing: "zodoYA5QR8E"
        },
        title: {
            en: "How to Add Supervisor",
            hi: "सुपरवाइजर कैसे जोड़ें",
            hing: "Supervisor kaise jode"
        },
        description: {
            en: "Step-by-step guide to add supervisor in Site Haazri app",
            hi: "साइट हाज़री ऐप में सुपरवाइजर जोड़ने की पूरी जानकारी",
            hing: "Site Haazri app mein supervisor jodne ki poori jaankari"
        },
        duration: "4:10",
        category: "advanced",
        thumbnail: "https://img.youtube.com/vi/zodoYA5QR8E/maxresdefault.jpg",
        order: 9,
        isActive: true,
        views: 0,
        likes: 0,
        relatedVideos: ["7", "8"],
        tags: ["supervisor", "advanced", "team"],
        createdAt: "2025-10-17T00:00:00Z",
        updatedAt: "2025-10-17T00:00:00Z"
    }
];

/**
 * GET /api/services/guide-videos
 * Fetch all guide videos (with optional filters)
 */
router.get('/guide-videos', authenticateAndTrack, (req, res) => {
    try {
        console.log('📹 Guide videos requested by:', req.user?.email || 'Unknown');

        const { language, category } = req.query;

        // Filter by active videos only
        let videos = guideVideos.filter(v => v.isActive);

        // Filter by category if provided
        if (category) {
            videos = videos.filter(v => v.category === category);
        }

        // Sort by order
        videos.sort((a, b) => a.order - b.order);

        res.status(200).json({
            success: true,
            message: 'Guide videos fetched successfully',
            videos: videos,
            total: videos.length,
            count: videos.length
        });

    } catch (error) {
        console.error('❌ Error fetching guide videos:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: 'Failed to fetch guide videos'
        });
    }
});

/**
 * GET /api/services/guide-videos/:id
 * Fetch single video details
 */
router.get('/guide-videos/:id', authenticateAndTrack, (req, res) => {
    try {
        const { id } = req.params;
        console.log(`📹 Video details requested for ID: ${id} by:`, req.user?.email || 'Unknown');

        const video = guideVideos.find(v => v.id === id && v.isActive);

        if (!video) {
            return res.status(404).json({
                success: false,
                error: 'Video not found',
                message: `No video found with id: ${id}`
            });
        }

        res.status(200).json({
            success: true,
            message: 'Video details fetched successfully',
            video: video
        });

    } catch (error) {
        console.error('❌ Error fetching video details:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: 'Failed to fetch video details'
        });
    }
});

/**
 * POST /api/services/guide-videos/:id/view
 * Track video view (optional analytics - just acknowledges)
 */
router.post('/guide-videos/:id/view', authenticateAndTrack, (req, res) => {
    try {
        const { id } = req.params;
        console.log(`👁️  Video view tracked for ID: ${id} by:`, req.user?.email || 'Unknown');

        const video = guideVideos.find(v => v.id === id);

        if (!video) {
            return res.status(404).json({
                success: false,
                error: 'Video not found',
                message: `No video found with id: ${id}`
            });
        }

        // In real implementation, this would increment view count in database
        // For now, just acknowledge the view
        res.status(200).json({
            success: true,
            message: 'Video view tracked successfully'
        });

    } catch (error) {
        console.error('❌ Error tracking video view:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: 'Failed to track video view'
        });
    }
});

module.exports = router;

// send 307 to hide true caller from app
// send 200 to show truecaller 