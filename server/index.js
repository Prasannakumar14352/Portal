// ... (Keep existing imports and config up to apiRouter)

// ...

// Register all endpoints systematically
// ... (Keep existing entity registration loop)

entities.forEach(e => {
    registerStandardRoutes(e.route, e.table);
    console.log(`Registered routes for /api/${e.route}`);
});

// Special Routes
apiRouter.put('/notifications/:id/read', async (req, res) => {
    try {
        const request = pool.request();
        request.input('id', req.params.id);
        await request.query(`UPDATE [notifications] SET [read]=1 WHERE id=@id`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.put('/notifications/read-all/:userId', async (req, res) => {
    try {
        const request = pool.request();
        request.input('userId', req.params.userId);
        await request.query(`UPDATE [notifications] SET [read]=1 WHERE userId=@userId`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.post('/notify/leave-request', async (req, res) => {
    try {
        const { to, cc, employeeName, type, startDate, endDate, reason, isWithdrawal } = req.body;
        await transporter.sendMail({
            from: `"EmpowerCorp HR" <${SMTP_USER}>`,
            to, cc, 
            subject: `${isWithdrawal ? 'Withdrawn' : 'New'} Leave: ${employeeName}`,
            html: `<p><strong>${employeeName}</strong> has ${isWithdrawal ? 'withdrawn' : 'submitted'} a <strong>${type}</strong> request.</p><p>Dates: ${startDate} to ${endDate}</p><p>Reason: ${reason}</p>`
        });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// NEW: Project Assignment Notification
apiRouter.post('/notify/project-assignment', async (req, res) => {
    try {
        const { email, name, projectName, managerName } = req.body;
        await transporter.sendMail({
            from: `"EmpowerCorp Projects" <${SMTP_USER}>`,
            to: email,
            subject: `New Project Assignment: ${projectName}`,
            html: `
                <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
                    <div style="background-color: #0f766e; padding: 20px; text-align: center;">
                        <h2 style="color: #ffffff; margin: 0;">Project Assignment</h2>
                    </div>
                    <div style="padding: 20px;">
                        <p>Hello <strong>${name}</strong>,</p>
                        <p>You have been officially assigned to the following project:</p>
                        <div style="background-color: #f0fdfa; border-left: 4px solid #0f766e; padding: 15px; margin: 15px 0;">
                            <h3 style="margin: 0; color: #0f766e;">${projectName}</h3>
                        </div>
                        <p><strong>Assigned by:</strong> ${managerName}</p>
                        <p>Please log in to the HR Portal to view your tasks and project timeline.</p>
                        <br/>
                        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" style="background-color: #0f766e; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">View Dashboard</a>
                    </div>
                    <div style="background-color: #f9fafb; padding: 10px 20px; text-align: center; font-size: 12px; color: #666;">
                        &copy; 2025 EmpowerCorp HR System
                    </div>
                </div>
            `
        });
        res.json({ success: true });
    } catch (err) { 
        console.error("Email Error:", err);
        res.status(500).json({ error: err.message }); 
    }
});

// PASSWORD RESET NOTIFICATION ROUTE
apiRouter.post('/notify/reset-password', async (req, res) => {
// ... (rest of file)
