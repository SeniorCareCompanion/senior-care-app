// ============================================================
// SENIOR CARE COMPANION - BACKEND API SERVER
// Family Notifications & Medication Tracking
// ============================================================

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const { Resend } = require('resend');
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
        const { id, username, email, age, firstName, lastName, phone, timezone, smsNotificationsEnabled, sms_consent, sms_consent_date, sms_consent_version } = req.body;

        console.log(`Creating user: id=${id}, username=${username}, email=${email}, age=${age}, phone=${phone || 'not provided'}, sms_consent=${sms_consent || false}`);

        // Capture IP address for audit trail
        const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
        console.log(`Client IP: ${clientIp}`);

        // Use provided email or generate a unique one
        const userEmail = email || `${username.toLowerCase()}-${id.substring(0, 8)}@senior-care.app`;

        // Try to insert the user
        const { data, error } = await supabase
            .from('users')
            .insert([{ 
                id, 
                username,
                email: userEmail,
                age: age || null,
                first_name: firstName || null,
                last_name: lastName || null,
                phone: phone || null,
                timezone: timezone || 'UTC',
                phone_verified: false,
                sms_reminders_enabled: smsNotificationsEnabled || false,
                notify_family_on_med: false,
                // SMS Consent Audit Fields
                sms_consent: sms_consent || false,
                sms_consent_date: sms_consent ? (sms_consent_date || new Date().toISOString()) : null,
                sms_consent_ip: sms_consent ? clientIp : null,
                sms_consent_version: sms_consent ? (sms_consent_version || 'v1.0') : null
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

// Update user's timezone
app.put('/api/users/:userId/timezone', async (req, res) => {
    try {
        const { userId } = req.params;
        const { timezone } = req.body;

        if (!timezone) {
            return res.status(400).json({ error: 'Timezone required' });
        }

        console.log(`📍 Updating timezone for user ${userId}: ${timezone}`);

        const { data, error } = await supabase
            .from('users')
            .update({ timezone: timezone })
            .eq('id', userId)
            .select();

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json({ 
            success: true, 
            message: 'Timezone updated',
            data: data[0]
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Log medication as taken
app.post('/api/medications/mark-taken', async (req, res) => {
    try {
        const { user_id, medication_id, medication_name } = req.body;

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

        // Always send notifications to approved family members
        await sendMedicationNotification(user_id, medication_name, 'taken');

        res.json({ 
            success: true, 
            data: logData[0],
            message: 'Medication marked as taken and family notified'
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

        // Log notification and send email for each family member
        for (const connection of connections || []) {
            // Get family member's email and timezone
            const { data: familyMember } = await supabase
                .from('users')
                .select('email, timezone')
                .eq('id', connection.family_member_user_id)
                .single();

            // Log notification to database
            await supabase
                .from('notification_logs')
                .insert({
                    senior_user_id: seniorUserId,
                    family_member_user_id: connection.family_member_user_id,
                    notification_type: `medication_${action}`,
                    medication_id: medicationName,
                    message: message
                });

            // Send email notification if service available
            if (resendClient && familyMember?.email) {
                try {
                    const emailSubject = action === 'taken' 
                        ? `✅ ${seniorName} took their ${medicationName}`
                        : `⚠️ ${seniorName} missed their ${medicationName}`;

                    const familyTimezone = familyMember?.timezone || 'UTC';
                    const now = new Date();
                    let formattedTime = 'Unknown time';
                    
                    try {
                        const options = {
                            year: 'numeric',
                            month: 'numeric',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: true,
                            timeZone: familyTimezone
                        };
                        formattedTime = new Intl.DateTimeFormat('en-US', options).format(now);
                    } catch (timeError) {
                        formattedTime = now.toLocaleString();
                    }
                    
                    const emailHtml = `
                        <h2>${message}</h2>
                        <p>Medication: <strong>${medicationName}</strong></p>
                        <p>Time: ${formattedTime}</p>
                        <hr>
                        <p style="color: #666; font-size: 12px;">Family Care 360</p>
                    `;

                    await resendClient.emails.send({
                        from: 'Family Care 360 <noreply@familycare360.app>',
                        to: familyMember.email,
                        subject: emailSubject,
                        html: emailHtml,
                        reply_to: 'support@familycare360.app'
                    });

                    console.log(`📧 Email sent to ${familyMember.email} for ${medicationName}`);
                } catch (emailError) {
                    console.error(`⚠️ Failed to send email to ${familyMember?.email}:`, emailError.message);
                }
            }
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

        // Ensure all timestamps have Z appended (UTC indicator)
        const fixedData = data.map(notification => {
            if (notification.sent_at && !notification.sent_at.endsWith('Z')) {
                notification.sent_at = notification.sent_at + 'Z';
            }
            if (notification.created_at && !notification.created_at.endsWith('Z')) {
                notification.created_at = notification.created_at + 'Z';
            }
            if (notification.read_at && !notification.read_at.endsWith('Z')) {
                notification.read_at = notification.read_at + 'Z';
            }
            return notification;
        });

        res.json({ 
            success: true, 
            data: fixedData,
            count: fixedData.length
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
// SMS NOTIFICATIONS via AWS SNS
// ============================================================

let sns = null;

// Only initialize AWS SNS if credentials are provided
if (process.env.SENIOR_CARE_AWS_ACCESS_KEY && process.env.SENIOR_CARE_AWS_SECRET_ACCESS_KEY) {
  try {
    const AWS = require('aws-sdk');
    
    // Configure AWS (using Vercel-safe environment variable names)
    AWS.config.update({
      accessKeyId: process.env.SENIOR_CARE_AWS_ACCESS_KEY,
      secretAccessKey: process.env.SENIOR_CARE_AWS_SECRET_ACCESS_KEY,
      region: process.env.SENIOR_CARE_AWS_REGION || 'us-east-1'
    });
    
    sns = new AWS.SNS();
    console.log('✅ AWS SNS initialized successfully');
    console.log('   Region:', process.env.SENIOR_CARE_AWS_REGION || 'us-east-1');
  } catch (error) {
    console.error('⚠️ AWS SNS initialization failed:', error.message);
    console.log('ℹ️ SMS notifications will be unavailable');
  }
} else {
  console.log('ℹ️ AWS credentials not configured. SMS notifications disabled.');
  console.log('   AWS_ACCESS_KEY present:', !!process.env.SENIOR_CARE_AWS_ACCESS_KEY);
  console.log('   AWS_SECRET_KEY present:', !!process.env.SENIOR_CARE_AWS_SECRET_ACCESS_KEY);
}

// Send SMS notification
app.post('/api/send-sms', async (req, res) => {
  try {
    // Check if SNS is initialized
    if (!sns) {
      return res.status(503).json({ 
        success: false, 
        error: 'SMS service not configured. AWS credentials missing.' 
      });
    }

    const { phoneNumber, message } = req.body;

    // Validate inputs
    if (!phoneNumber || !message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Phone number and message required' 
      });
    }

    // Format phone number (ensure +1 prefix for US numbers)
    let formattedNumber = phoneNumber;
    if (!formattedNumber.startsWith('+')) {
      formattedNumber = '+1' + phoneNumber.replace(/\D/g, '');
    }

    console.log(`📱 Sending SMS to ${formattedNumber}: ${message}`);

    // Send via SNS
    const result = await sns.publish({
      Message: message,
      PhoneNumber: formattedNumber
    }).promise();

    console.log(`✅ SMS sent successfully. MessageId: ${result.MessageId}`);

    res.json({ 
      success: true, 
      messageId: result.MessageId,
      phoneNumber: formattedNumber
    });

  } catch (error) {
    console.error('❌ SMS Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Test SMS endpoint (for testing)
app.post('/api/test-sms', async (req, res) => {
  try {
    // Check if SNS is initialized
    if (!sns) {
      return res.status(503).json({ 
        success: false, 
        error: 'SMS service not configured. AWS credentials missing.' 
      });
    }

    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ 
        success: false, 
        error: 'Phone number required' 
      });
    }

    const testMessage = '✅ Test SMS from Senior Care Companion. Notifications are working!';

    const result = await sns.publish({
      Message: testMessage,
      PhoneNumber: phoneNumber.startsWith('+') ? phoneNumber : '+1' + phoneNumber.replace(/\D/g, '')
    }).promise();

    res.json({ 
      success: true, 
      message: 'Test SMS sent!',
      messageId: result.MessageId
    });

  } catch (error) {
    console.error('❌ Test SMS Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ============================================================
// EMAIL NOTIFICATIONS via RESEND
// ============================================================

let resendClient = null;

// Only initialize Resend if API key is provided
if (process.env.RESEND_API_KEY) {
  try {
    const resend = require('resend');
    resendClient = new resend.Resend(process.env.RESEND_API_KEY);
    console.log('✅ Resend email client initialized successfully');
  } catch (error) {
    console.error('⚠️ Resend initialization failed:', error.message);
    console.log('ℹ️ Email notifications will be unavailable');
  }
} else {
  console.log('ℹ️ Resend API key not configured. Email notifications disabled.');
}

// Send email notification
app.post('/api/send-email', async (req, res) => {
  try {
    // Check if Resend is initialized
    if (!resendClient) {
      return res.status(503).json({ 
        success: false, 
        error: 'Email service not configured. Resend API key missing.' 
      });
    }

    const { email, subject, message, html } = req.body;

    // Validate inputs
    if (!email || !subject || (!message && !html)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email, subject, and message (or html) required' 
      });
    }

    console.log(`📧 Sending email to ${email}: ${subject}`);

    // Send via Resend
    const result = await resendClient.emails.send({
      from: 'Senior Care Companion <onboarding@resend.dev>',
      to: email,
      subject: subject,
      html: html || `<p>${message}</p>`,
      reply_to: 'support@seniorcare.com'
    });

    if (result.error) {
      throw result.error;
    }

    console.log(`✅ Email sent successfully. MessageId: ${result.data.id}`);

    res.json({ 
      success: true, 
      messageId: result.data.id,
      email: email
    });

  } catch (error) {
    console.error('❌ Email Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Test email endpoint
app.post('/api/test-email', async (req, res) => {
  try {
    // Check if Resend is initialized
    if (!resendClient) {
      return res.status(503).json({ 
        success: false, 
        error: 'Email service not configured. Resend API key missing.' 
      });
    }

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email required' 
      });
    }

    const result = await resendClient.emails.send({
      from: 'Senior Care Companion <onboarding@resend.dev>',
      to: email,
      subject: '✅ Senior Care Companion - Email Test',
      html: `
        <h2>Email Notifications Working!</h2>
        <p>This is a test email from Senior Care Companion.</p>
        <p>When family members are invited, they'll receive emails like this when medications are logged.</p>
        <hr>
        <p style="color: #666; font-size: 12px;">Senior Care Companion</p>
      `,
      reply_to: 'support@seniorcare.com'
    });

    if (result.error) {
      throw result.error;
    }

    res.json({ 
      success: true, 
      message: 'Test email sent!',
      messageId: result.data.id
    });

  } catch (error) {
    console.error('❌ Test Email Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
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

// ============================================================
// SCHEDULED NOTIFICATIONS - Server-Side Scheduler
// ============================================================

// Check and send scheduled medication notifications
app.post('/api/check-and-send-scheduled-notifications', async (req, res) => {
  try {
    // ===== VALIDATE BEARER TOKEN =====
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.warn('⚠️ [SCHEDULER] CRON_SECRET not set in environment variables');
      return res.status(500).json({ 
        success: false, 
        error: 'CRON_SECRET not configured' 
      });
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ [SCHEDULER] Missing or invalid Authorization header');
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized - Missing Bearer token' 
      });
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix
    if (token !== cronSecret) {
      console.error('❌ [SCHEDULER] Invalid bearer token');
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized - Invalid token' 
      });
    }

    console.log('✅ [SCHEDULER] Authorization successful');
    console.log('🔔 [SCHEDULER] Checking for pending notifications...');

    // ===== CHECK IF RESEND IS CONFIGURED =====
    if (!resendClient) {
      console.error('❌ [SCHEDULER] Resend email client not initialized');
      return res.status(500).json({ 
        success: false, 
        error: 'Email service not configured',
        message: 'RESEND_API_KEY not set in environment variables'
      });
    }

    // Get all pending notifications that are due
    const { data: pendingNotifications, error: fetchError } = await supabase
      .from('scheduled_notifications')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_time', new Date().toISOString());

    if (fetchError) {
      throw fetchError;
    }

    if (!pendingNotifications || pendingNotifications.length === 0) {
      console.log('✅ [SCHEDULER] No pending notifications');
      return res.json({ 
        success: true, 
        message: 'No pending notifications',
        checked: 0 
      });
    }

    console.log(`📬 [SCHEDULER] Found ${pendingNotifications.length} notifications to send`);

    let sentCount = 0;
    let failedCount = 0;

    // Process each notification
    for (const notification of pendingNotifications) {
      try {
        const { senior_user_id, medication_name, id } = notification;

        // Get senior user details
        const { data: senior, error: seniorError } = await supabase
          .from('users')
          .select('email, first_name, last_name, timezone, phone, sms_reminders_enabled, sms_carrier')
          .eq('id', senior_user_id)
          .single();

        if (seniorError) throw seniorError;

        const seniorName = `${senior.first_name || 'User'} ${senior.last_name || ''}`.trim();

        // ===== STEP 1: SEND MEDICATION REMINDER TO SENIOR =====
        console.log(`📱 [SCHEDULER] Sending medication reminder to senior: ${seniorName}`);
        
        try {
          // Send email reminder to senior
          const seniorEmailResult = await resendClient.emails.send({
            from: 'noreply@familycare360.app',
            to: senior.email,
            subject: `💊 Medication Reminder: Time for ${medication_name}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #fff3e0; border-radius: 8px;">
                <h2 style="color: #e65100; margin-bottom: 20px;">⏰ Medication Reminder</h2>
                <div style="background: white; padding: 20px; border-left: 4px solid #ff6f00; margin: 20px 0; border-radius: 4px;">
                  <p style="margin: 0 0 10px 0; color: #333; font-size: 16px;">
                    Hi ${senior.first_name || 'there'},
                  </p>
                  <p style="margin: 0; color: #333; font-size: 18px;">
                    It's time to take your <strong style="color: #ff6f00;">${medication_name}</strong>
                  </p>
                  <p style="margin: 15px 0 0 0; color: #666; font-size: 14px;">
                    Scheduled for: <strong>${new Date(notification.scheduled_time).toLocaleString('en-US', {timeZone: senior.timezone || 'America/Denver', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'})}</strong>
                  </p>
                </div>
                <div style="background: #f5f5f5; padding: 15px; border-radius: 6px; margin: 20px 0;">
                  <p style="margin: 0; color: #666; font-size: 14px;">
                    ✅ Tap "Mark as Taken" in the app when you've taken this medication.
                  </p>
                </div>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                
                ${senior.sms_carrier === 'email-only' ? `
                <div style="background: #f0f7ff; padding: 12px; border-radius: 6px; border-left: 3px solid #2196F3; margin: 15px 0;">
                  <p style="margin: 0; font-size: 12px; color: #1565c0; line-height: 1.6;">
                    💡 <strong>Tip:</strong> Want to receive medication reminders as text messages instead of email? 
                    Open the app, go to <strong>Settings > SMS</strong>, and select your mobile carrier. 
                    You'll get both SMS and email reminders!
                  </p>
                </div>
                ` : ''}
                
                <p style="color: #999; font-size: 12px;">
                  This is an automated reminder from Senior Care Companion
                </p>
              </div>
            `,
            reply_to: 'seniorcarecompanion360@gmail.com'
          });

          if (seniorEmailResult.error) {
            console.error(`❌ Failed to send email to senior ${senior.email}:`, seniorEmailResult.error);
          } else {
            console.log(`✅ Medication reminder email sent to senior: ${senior.email}`);
          }

          // ===== SEND SMS VIA EMAIL GATEWAY (if enabled and carrier is NOT email-only) =====
          if (senior.sms_reminders_enabled && senior.phone && senior.sms_carrier && senior.sms_carrier !== 'email-only') {
            try {
              // Map carrier to SMS gateway domain
              const carrierGatewayMap = {
                'verizon': 'vtext.com',
                'att': 'txt.att.com',
                'tmobile': 'tmomail.net',
                'sprint': 'messaging.sprintpcs.com',
                'uscellular': 'email.uscc.net',
                'virgin': 'vmobl.com',
                'boost': 'smsd.boostmobile.com',
                'metropcs': 'myboostmobile.com'
              };

              const gatewayDomain = carrierGatewayMap[senior.sms_carrier.toLowerCase()];
              
              if (gatewayDomain) {
                const smsGatewayEmail = `${senior.phone}@${gatewayDomain}`;
                
                // SMS message (keep it short - 160 char limit)
                const smsMessage = `Senior Care: Time to take your ${medication_name}. Reply HELP for info or STOP to opt out.`;
                
                const smsResult = await resendClient.emails.send({
                  from: 'noreply@familycare360.app',
                  to: smsGatewayEmail,
                  subject: 'Senior Care Medication Reminder',
                  text: smsMessage,
                  html: `<p>${smsMessage}</p>`
                });

                if (smsResult.error) {
                  console.error(`❌ Failed to send SMS via ${senior.sms_carrier} to ${smsGatewayEmail}:`, smsResult.error);
                } else {
                  console.log(`✅ SMS reminder sent via ${senior.sms_carrier} gateway to ${senior.phone}`);
                }
              } else {
                console.warn(`⚠️ Unknown carrier: ${senior.sms_carrier}`);
              }
            } catch (smsError) {
              console.error(`❌ Error sending SMS via gateway:`, smsError);
            }
          }
          
        } catch (seniorError) {
          console.error(`❌ Error sending reminder to senior:`, seniorError);
        }

        // ===== STEP 2: GET FAMILY CONNECTIONS & SEND FAMILY NOTIFICATIONS =====
        // Get family connections for this senior
        const { data: connections, error: connError } = await supabase
          .from('family_connections')
          .select(`
            *,
            family_member:family_member_user_id(email, first_name, last_name)
          `)
          .eq('senior_user_id', senior_user_id)
          .eq('approved_by_senior', true);

        if (connError) throw connError;

        // Send notifications to all family members
        if (connections && connections.length > 0) {
          console.log(`📧 [SCHEDULER] Sending family notifications to ${connections.length} family members`);
          
          for (const connection of connections) {
            try {
              const familyEmail = connection.family_member.email;
              const familyName = `${connection.family_member.first_name || 'Family Member'} ${connection.family_member.last_name || ''}`.trim();

              // Send email notification to family member
              const emailResult = await resendClient.emails.send({
                from: 'noreply@familycare360.app',
                to: familyEmail,
                subject: `💊 Medication Reminder: ${seniorName}`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; border-radius: 8px;">
                    <h2 style="color: #2ecc71; margin-bottom: 20px;">💊 Medication Reminder</h2>
                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                      Hi ${familyName},
                    </p>
                    <div style="background: white; padding: 20px; border-left: 4px solid #2ecc71; margin: 20px 0; border-radius: 4px;">
                      <p style="margin: 0; color: #333;">
                        <strong>${seniorName}</strong> has a scheduled medication reminder:
                      </p>
                      <p style="margin: 10px 0 0 0; font-size: 18px; color: #2ecc71;">
                        <strong>${medication_name}</strong>
                      </p>
                    </div>
                    <p style="color: #666; font-size: 14px;">
                      Scheduled for: <strong>${new Date(notification.scheduled_time).toLocaleString()}</strong>
                    </p>
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                    <p style="color: #999; font-size: 12px;">
                      This is an automated notification from Senior Care Companion
                    </p>
                  </div>
                `,
                reply_to: 'seniorcarecompanion360@gmail.com'
              });

              if (emailResult.error) {
                console.error(`❌ Failed to send email to ${familyEmail}:`, emailResult.error);
              } else {
                console.log(`✅ Family notification email sent to ${familyEmail}`);
              }
            } catch (familyError) {
              console.error(`❌ Error notifying family member:`, familyError);
            }
          }
        }

        // Update notification status to sent
        const { error: updateError } = await supabase
          .from('scheduled_notifications')
          .update({ 
            status: 'sent',
            sent_at: new Date().toISOString()
          })
          .eq('id', id);

        if (updateError) {
          throw updateError;
        }

        sentCount++;
        console.log(`✅ [SCHEDULER] Notification ${id} marked as sent`);

      } catch (notifError) {
        console.error(`❌ Error processing notification:`, notifError);
        failedCount++;

        // Mark as failed
        try {
          await supabase
            .from('scheduled_notifications')
            .update({ status: 'failed' })
            .eq('id', notification.id);
        } catch (e) {
          console.error('Failed to update notification status:', e);
        }
      }
    }

    res.json({ 
      success: true, 
      message: `Processed ${sentCount} notifications`,
      sent: sentCount,
      failed: failedCount
    });

  } catch (error) {
    console.error('❌ [SCHEDULER] Fatal error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Create scheduled notifications for a medication
app.post('/api/create-scheduled-notifications', async (req, res) => {
  try {
    const { userId, medication, timezone } = req.body;

    if (!userId || !medication || !timezone) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing userId, medication, or timezone' 
      });
    }

    console.log(`📬 Creating scheduled notifications for ${medication.name} in timezone ${timezone}`);

    // Helper: Get today's date in the specified timezone (as YYYY-MM-DD)
    function getTodayInTimezone(tz) {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      
      const parts = formatter.format(now).split('/');
      return {
        year: parseInt(parts[2]),
        month: parseInt(parts[0]),
        day: parseInt(parts[1])
      };
    }

    // Helper: Convert local time in a timezone to UTC
    function localTimeToUTC(year, month, day, hours, minutes, tz) {
      // Use date-fns-tz style: create a date assuming it's in that timezone, then get UTC
      const testDate = new Date(year, month - 1, day, hours, minutes, 0);
      
      // Format this test date as if it's UTC
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      
      const tzString = formatter.format(testDate);
      const [m, d, y, h, min, s] = tzString.match(/(\d+)\/(\d+)\/(\d+),\s(\d+):(\d+):(\d+)/).slice(1);
      
      // Calculate offset
      const tzTime = new Date(parseInt(y), parseInt(m) - 1, parseInt(d), parseInt(h), parseInt(min), parseInt(s)).getTime();
      const offset = testDate.getTime() - tzTime;
      
      // Apply offset to get UTC time
      return new Date(testDate.getTime() - offset);
    }

    const reminders = [];
    const reminderMinutes = medication.reminderMinutes || 10;

    // Get TODAY in user's timezone
    const todayTz = getTodayInTimezone(timezone);

    console.log(`📅 Today in ${timezone}: ${todayTz.year}-${String(todayTz.month).padStart(2, '0')}-${String(todayTz.day).padStart(2, '0')}`);

    // Generate notifications for next 30 days
    for (let daysFromNow = 0; daysFromNow < 30; daysFromNow++) {
      const checkDate = new Date(todayTz.year, todayTz.month - 1, todayTz.day);
      checkDate.setDate(checkDate.getDate() + daysFromNow);
      
      const year = checkDate.getFullYear();
      const month = checkDate.getMonth() + 1;
      const day = checkDate.getDate();

      // Check if medication should be taken on this date
      let shouldSchedule = false;
      
      if (medication.recurrence === 'daily') {
        shouldSchedule = true;
      } else if (medication.recurrence === 'specific-days' && medication.specificDays) {
        const dayOfWeek = checkDate.getDay();
        shouldSchedule = medication.specificDays.includes(dayOfWeek);
      } else if (medication.recurrence === 'every-x-days' && medication.everyXDays) {
        const startDate = new Date(medication.startDate || new Date().toISOString().split('T')[0]);
        const daysDiff = Math.floor((checkDate - startDate) / (1000 * 60 * 60 * 24));
        shouldSchedule = daysDiff >= 0 && daysDiff % medication.everyXDays === 0;
      } else if (medication.recurrence === 'weekly' && medication.weeklyDay !== undefined) {
        shouldSchedule = checkDate.getDay() === medication.weeklyDay;
      }

      if (shouldSchedule) {
        // Create notification for each dose time
        for (const time of medication.times) {
          const [hours, minutes] = time.split(':').map(Number);
          
          // Convert to UTC
          const medicationTimeUTC = localTimeToUTC(year, month, day, hours, minutes, timezone);
          
          // Subtract reminder minutes
          const reminderTimeUTC = new Date(medicationTimeUTC.getTime() - reminderMinutes * 60000);
          
          console.log(`📅 ${medication.name} at ${time} on ${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${timezone}`);
          console.log(`   → Reminder UTC: ${reminderTimeUTC.toISOString()}`);
          
          // Only add if in the future
          if (reminderTimeUTC > new Date()) {
            reminders.push({
              senior_user_id: userId,
              medication_name: medication.name,
              scheduled_time: reminderTimeUTC.toISOString(),
              reminder_minutes: reminderMinutes,
              status: 'pending'
            });
          }
        }
      }
    }

    if (reminders.length === 0) {
      return res.json({ 
        success: true, 
        message: 'No future notifications to schedule',
        notificationCount: 0
      });
    }

    // Insert into Supabase
    const { data, error } = await supabase
      .from('scheduled_notifications')
      .insert(reminders);

    if (error) {
      throw error;
    }

    console.log(`✅ Created ${reminders.length} scheduled notifications`);
    
    res.json({ 
      success: true, 
      message: `Created ${reminders.length} scheduled notifications`,
      notificationCount: reminders.length
    });

  } catch (error) {
    console.error('❌ Error creating scheduled notifications:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ============================================================
// ERROR HANDLING MIDDLEWARE
// ============================================================

app.use((err, req, res, next) => {
    console.error('❌ Server Error:', err.stack);
    res.status(500).json({ 
        success: false,
        error: 'Internal Server Error' 
    });
});

// ============================================================
// START SERVER
// ============================================================


// ============================================================
// ERROR HANDLING MIDDLEWARE
// ============================================================

app.use((err, req, res, next) => {
    console.error('❌ Server Error:', err.stack);
    res.status(500).json({ 
        success: false,
        error: 'Internal Server Error' 
    });
});

// ============================================================
// SMS WEBHOOK HANDLERS (Inbound Messages)
// ============================================================

// Primary inbound SMS handler (STOP/HELP)
app.post('/api/sms/inbound', async (req, res) => {
  try {
    const incomingMessage = req.body.Body?.trim().toUpperCase() || '';
    const fromNumber = req.body.From || '';
    
    console.log(`📱 Inbound SMS from ${fromNumber}: "${incomingMessage}"`);
    
    let responseText = '';
    
    if (incomingMessage === 'STOP') {
      responseText = 'You have been unsubscribed from Senior Care Companion SMS messages.';
      // TODO: Mark user as opted out in database
      console.log(`✅ STOP received from ${fromNumber}`);
    } else if (incomingMessage === 'HELP') {
      responseText = 'For assistance with Senior Care Companion, visit https://seniorcarecompanion.github.io/senior-care-app/ or email seniorcarecompanion360@gmail.com. Reply STOP to opt-out.';
      console.log(`✅ HELP received from ${fromNumber}`);
    } else if (incomingMessage === 'START' || incomingMessage === 'YES') {
      responseText = 'You have been resubscribed to Senior Care Companion SMS messages.';
      // TODO: Mark user as opted back in
      console.log(`✅ START/YES received from ${fromNumber}`);
    } else {
      responseText = 'Thank you for your message. Reply STOP to opt-out or HELP for assistance.';
    }
    
    // Send response SMS via Twilio
    const twilio = require('twilio');
    const client = new twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    
    await client.messages.create({
      body: responseText,
      from: req.body.To, // Send from the number message came to
      to: fromNumber
    });
    
    // Return TwiML response
    res.set('Content-Type', 'text/xml');
    res.send(`
      <Response>
        <Message>${responseText}</Message>
      </Response>
    `);
    
  } catch (error) {
    console.error('❌ Error handling inbound SMS:', error);
    res.status(500).json({ error: error.message });
  }
});

// Fallback inbound SMS handler
app.post('/api/sms/inbound-fallback', async (req, res) => {
  console.log('⚠️ Fallback webhook called - primary may have failed');
  // Same logic as primary
  return app._router.stack.find(r => r.route && r.route.path === '/api/sms/inbound').handle(req, res);
});

// Delivery Status Callback
app.post('/api/sms/status', async (req, res) => {
  try {
    const messageStatus = req.body.MessageStatus || 'unknown';
    const messageSid = req.body.MessageSid || '';
    const toNumber = req.body.To || '';
    
    console.log(`📊 SMS Status Update: SID=${messageSid}, Status=${messageStatus}, To=${toNumber}`);
    
    // Log status to database if needed
    if (process.env.SUPABASE_URL) {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
      
      await supabase
        .from('notification_logs')
        .insert([{
          type: 'sms',
          recipient_phone: toNumber,
          message_sid: messageSid,
          status: messageStatus,
          created_at: new Date().toISOString()
        }]);
    }
    
    res.json({ success: true, status: messageStatus });
    
  } catch (error) {
    console.error('❌ Error logging SMS status:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// TWILIO SMS SENDING (Primary method via Messaging Service)
// ============================================================

app.post('/api/send-sms-twilio', async (req, res) => {
  try {
    const { phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Phone number and message required' 
      });
    }

    // Validate Twilio credentials
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_MESSAGING_SERVICE_SID) {
      return res.status(503).json({ 
        success: false, 
        error: 'Twilio credentials not configured' 
      });
    }

    const twilio = require('twilio');
    const client = new twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

    // Format phone number
    let formattedPhone = phone;
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+1' + phone.replace(/\D/g, '');
    }

    console.log(`📱 Sending SMS via Twilio to ${formattedPhone}: "${message}"`);

    const messageSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

    const result = await client.messages.create({
      messagingServiceSid: messageSid,
      to: formattedPhone,
      body: message
    });

    console.log(`✅ SMS sent via Twilio. SID: ${result.sid}`);

    res.json({ 
      success: true, 
      messageSid: result.sid,
      phone: formattedPhone,
      status: result.status
    });

  } catch (error) {
    console.error('❌ Twilio SMS Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ============================================================
// UPDATE SMS PREFERENCES (Phone, Carrier, SMS Enabled)
// ============================================================

app.post('/api/update-sms-preferences', async (req, res) => {
  try {
    const { userId, phone, carrier, smsEnabled } = req.body;

    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID required' 
      });
    }

    console.log(`📱 Updating SMS preferences for user ${userId}: phone=${phone}, carrier=${carrier}, enabled=${smsEnabled}`);

    // Prepare update data
    const updateData = {
      sms_reminders_enabled: smsEnabled || false
    };

    // Add phone if provided
    if (phone) {
      // Clean phone: remove all non-digits
      const cleanPhone = phone.replace(/\D/g, '');
      updateData.phone = cleanPhone;
    }

    // Add carrier if provided
    if (carrier) {
      updateData.sms_carrier = carrier;
    }

    // Update user in Supabase
    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select();

    if (error) {
      console.error('❌ Error updating SMS preferences:', error);
      return res.status(400).json({ 
        success: false, 
        error: error.message 
      });
    }

    console.log('✅ SMS preferences updated successfully');
    res.json({ 
      success: true, 
      message: 'SMS preferences updated',
      data: data[0]
    });

  } catch (error) {
    console.error('❌ SMS preferences update error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});
