// ============================================================
// SENIOR CARE COMPANION - BACKEND API SERVER
// Family Notifications & Medication Tracking
// ============================================================

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
require('dotenv').config();

const app = express();

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(cors());
app.use(express.json());

// ============================================================
// SUPABASE CLIENT
// ============================================================

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================================
// HEALTH CHECK ENDPOINT
// ============================================================

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        message: 'Senior Care Companion API is running!',
        timestamp: new Date().toISOString()
    });
});

// ============================================================
// FAMILY CONNECTIONS ENDPOINTS
// ============================================================

// Get all family connections for a senior (connections they sent)
app.get('/api/family-connections/:seniorUserId', async (req, res) => {
    try {
        const { seniorUserId } = req.params;

        const { data, error } = await supabase
            .from('family_connections')
            .select(`
                *,
                family_member:family_member_user_id(email, username)
            `)
            .eq('senior_user_id', seniorUserId);

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json({ 
            success: true, 
            data: data,
            message: `Found ${data.length} family connections`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all family connections received by a family member (invitations they received)
app.get('/api/family-connections/received/:familyMemberId', async (req, res) => {
    try {
        const { familyMemberId } = req.params;

        const { data, error } = await supabase
            .from('family_connections')
            .select(`
                *,
                senior:senior_user_id(id, email, username)
            `)
            .eq('family_member_user_id', familyMemberId);

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json({ 
            success: true, 
            data: data,
            message: `Found ${data.length} pending invitations`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create a family connection (invite)
app.post('/api/family-connections', async (req, res) => {
    try {
        const { senior_user_id, family_member_email, family_member_username, relationship } = req.body;

        // Find the family member by BOTH email AND username (to handle multiple users per email)
        const { data: familyMembers, error: findError } = await supabase
            .from('users')
            .select('id')
            .eq('email', family_member_email)
            .eq('username', family_member_username);

        if (findError || !familyMembers || familyMembers.length === 0) {
            return res.status(400).json({ 
                error: 'Family member not found. Please check the email and username are correct.' 
            });
        }

        const familyMember = familyMembers[0];

        // Create the connection
        const { data, error } = await supabase
            .from('family_connections')
            .insert({
                senior_user_id: senior_user_id,
                family_member_user_id: familyMember.id,
                relationship: relationship,
                permission_level: 'notifications_only',
                approved_by_senior: false
            })
            .select();

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json({ 
            success: true, 
            data: data[0],
            message: 'Family connection invitation created'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Approve a family connection
app.put('/api/family-connections/:connectionId/approve', async (req, res) => {
    try {
        const { connectionId } = req.params;

        const { data, error } = await supabase
            .from('family_connections')
            .update({ approved_by_senior: true })
            .eq('id', connectionId)
            .select();

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json({ 
            success: true, 
            data: data[0],
            message: 'Family connection approved'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Approve a family connection (PATCH endpoint for frontend compatibility)
app.patch('/api/family-connections/:connectionId/approve', async (req, res) => {
    try {
        const { connectionId } = req.params;

        const { data, error } = await supabase
            .from('family_connections')
            .update({ approved_by_senior: true })
            .eq('id', connectionId)
            .select();

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json({ 
            success: true, 
            data: data[0],
            message: 'Family connection approved'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete/Reject a family connection
app.delete('/api/family-connections/:connectionId', async (req, res) => {
    try {
        const { connectionId } = req.params;

        const { data, error } = await supabase
            .from('family_connections')
            .delete()
            .eq('id', connectionId)
            .select();

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json({ 
            success: true, 
            data: data[0],
            message: 'Family connection declined'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// MEDICATION TRACKING ENDPOINTS
// ============================================================

// Create a user if they don't exist
app.post('/api/users', async (req, res) => {
    try {
        const { id, username, email, age } = req.body;

        console.log(`Creating user: id=${id}, username=${username}, email=${email}, age=${age}`);

        // Use provided email or generate a unique one
        const userEmail = email || `${username.toLowerCase()}-${id.substring(0, 8)}@senior-care.app`;

        // Try to insert the user
        const { data, error } = await supabase
            .from('users')
            .insert([{ 
                id, 
                username,
                email: userEmail,
                age: age || null
            }])
            .select();

        if (error) {
            console.error('User creation error:', error);
            // User might already exist, that's ok - just return success
            if (error.code === '23505') { // Unique constraint violation
                return res.json({ 
                    message: 'User already exists',
                    id: id
                });
            }
            return res.status(400).json({ error: error.message });
        }

        console.log('User created successfully:', data);
        res.json({ 
            success: true, 
            message: 'User created successfully',
            data: data[0]
        });
    } catch (error) {
        console.error('User creation exception:', error);
        res.status(500).json({ error: error.message });
    }
});

// Log medication as taken
app.post('/api/medications/mark-taken', async (req, res) => {
    try {
        const { user_id, medication_id, medication_name } = req.body;

        // Check if feature is enabled
        const { data: featureData } = await supabase
            .from('features')
            .select('enabled')
            .eq('id', 'family_notifications')
            .single();

        const notificationsEnabled = featureData?.enabled || false;

        // Log the medication
        const { data: logData, error: logError } = await supabase
            .from('medication_logs')
            .insert({
                user_id: user_id,
                medication_id: medication_id,
                medication_name: medication_name,
                taken_time: new Date().toISOString(),
                status: 'taken'
            })
            .select();

        if (logError) {
            return res.status(400).json({ error: logError.message });
        }

        // Send notifications to family members (if feature enabled)
        if (notificationsEnabled) {
            await sendMedicationNotification(user_id, medication_name, 'taken');
        }

        res.json({ 
            success: true, 
            data: logData[0],
            notificationsEnabled: notificationsEnabled,
            message: 'Medication marked as taken'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get medication adherence for a senior
app.get('/api/medications/adherence/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { days = 7 } = req.query; // Default to last 7 days

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));

        const { data, error } = await supabase
            .from('medication_logs')
            .select('*')
            .eq('user_id', userId)
            .gte('created_at', startDate.toISOString());

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        // Calculate stats
        const total = data.length;
        const taken = data.filter(log => log.status === 'taken').length;
        const missed = data.filter(log => log.status === 'missed').length;
        const adherenceRate = total > 0 ? ((taken / total) * 100).toFixed(1) : 0;

        res.json({ 
            success: true, 
            data: {
                period_days: parseInt(days),
                total_medications: total,
                taken: taken,
                missed: missed,
                adherence_rate: `${adherenceRate}%`,
                logs: data
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// NOTIFICATION ENDPOINTS
// ============================================================

// Send notification to family members
async function sendMedicationNotification(seniorUserId, medicationName, action) {
    try {
        // Get all family members for this senior
        const { data: connections, error: connectError } = await supabase
            .from('family_connections')
            .select('family_member_user_id')
            .eq('senior_user_id', seniorUserId)
            .eq('approved_by_senior', true);

        if (connectError) {
            console.error('Error fetching family connections:', connectError);
            return;
        }

        // Get senior's name
        const { data: senior } = await supabase
            .from('users')
            .select('username')
            .eq('id', seniorUserId)
            .single();

        const seniorName = senior?.username || 'A senior';
        const message = action === 'taken' 
            ? `${seniorName} just took their ${medicationName}`
            : `${seniorName} missed their ${medicationName}`;

        // Log notification for each family member
        for (const connection of connections || []) {
            await supabase
                .from('notification_logs')
                .insert({
                    senior_user_id: seniorUserId,
                    family_member_user_id: connection.family_member_user_id,
                    notification_type: `medication_${action}`,
                    medication_id: medicationName,
                    message: message
                });
        }

        console.log(`✅ Notifications sent for: ${medicationName}`);
    } catch (error) {
        console.error('Error sending notifications:', error);
    }
}

// Get notifications for a family member
app.get('/api/notifications/:familyMemberId', async (req, res) => {
    try {
        const { familyMemberId } = req.params;
        const { limit = 10, unread = false } = req.query;

        let query = supabase
            .from('notification_logs')
            .select(`
                *,
                senior:senior_user_id(username, email)
            `)
            .eq('family_member_user_id', familyMemberId)
            .order('sent_at', { ascending: false })
            .limit(parseInt(limit));

        if (unread === 'true') {
            query = query.is('read_at', null);
        }

        const { data, error } = await query;

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json({ 
            success: true, 
            data: data,
            count: data.length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Mark notification as read
app.put('/api/notifications/:notificationId/read', async (req, res) => {
    try {
        const { notificationId } = req.params;

        const { data, error } = await supabase
            .from('notification_logs')
            .update({ read_at: new Date().toISOString() })
            .eq('id', notificationId)
            .select();

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json({ 
            success: true, 
            data: data[0],
            message: 'Notification marked as read'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// FEATURE TOGGLE ENDPOINTS
// ============================================================

// Get feature status
app.get('/api/features/:featureId', async (req, res) => {
    try {
        const { featureId } = req.params;

        const { data, error } = await supabase
            .from('features')
            .select('*')
            .eq('id', featureId)
            .single();

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json({ 
            success: true, 
            data: data
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Toggle feature (admin only - for testing)
app.put('/api/features/:featureId/toggle', async (req, res) => {
    try {
        const { featureId } = req.params;

        // Get current state
        const { data: current } = await supabase
            .from('features')
            .select('enabled')
            .eq('id', featureId)
            .single();

        // Toggle it
        const { data, error } = await supabase
            .from('features')
            .update({ enabled: !current.enabled })
            .eq('id', featureId)
            .select();

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json({ 
            success: true, 
            data: data[0],
            message: `Feature ${featureId} is now ${data[0].enabled ? 'ENABLED' : 'DISABLED'}`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// ERROR HANDLING
// ============================================================

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// ============================================================
// START SERVER
// ============================================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`
    ╔════════════════════════════════════════════════════════╗
    ║  🏥 SENIOR CARE COMPANION - BACKEND API                ║
    ║  ✅ Server running on port ${PORT}                        ║
    ║  📍 http://localhost:${PORT}                               ║
    ║  🔗 Health check: http://localhost:${PORT}/api/health     ║
    ╚════════════════════════════════════════════════════════╝
    `);
});

module.exports = app;
