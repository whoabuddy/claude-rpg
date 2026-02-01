# Phase 9: Integration

## Goal
Wire everything together and verify end-to-end functionality.

## Context
- All modules complete, need to integrate
- Update deployment scripts
- Document breaking changes
- Issue: #130

<plan>
  <goal>Complete server integration and deployment readiness</goal>
  <context>
    - Current deploy scripts in deploy/
    - systemd service file needs update
    - Document API changes for client
  </context>

  <task id="1">
    <name>Write integration tests</name>
    <files>server-v2/__tests__/integration/*.test.ts</files>
    <action>
      1. Create __tests__/integration/hook-to-xp.test.ts:
         - Simulate hook event (post_tool_use)
         - Verify persona created/updated
         - Verify project created/updated
         - Verify XP awarded
         - Verify event broadcast via WebSocket
      2. Create __tests__/integration/pane-to-persona.test.ts:
         - Simulate pane discovered
         - Verify Claude detection
         - Verify persona created with name and avatar
         - Verify session created
      3. Create __tests__/integration/quest-lifecycle.test.ts:
         - Create quest
         - Transition through states
         - Complete quest
         - Verify XP awarded
    </action>
    <verify>
      bun test server-v2/__tests__/integration
      All integration tests pass
    </verify>
    <done>Integration tests verify end-to-end flows</done>
  </task>

  <task id="2">
    <name>Update deployment configuration</name>
    <files>deploy/claude-rpg.service, deploy/deploy.sh, package.json</files>
    <action>
      1. Update deploy/claude-rpg.service:
         - Change ExecStart to use bun and server-v2
         - Update environment variables if needed
         - Add Restart=always
      2. Update deploy/deploy.sh:
         - Build server-v2 (if needed)
         - Restart service
      3. Update package.json:
         - Add "start:v2": "bun run server-v2/index.ts"
         - Add "test:v2": "bun test server-v2"
         - Add "build:v2": script if needed
    </action>
    <verify>
      Run deploy script locally (dry run)
      Verify service file syntax
    </verify>
    <done>Deployment configuration updated for v2</done>
  </task>

  <task id="3">
    <name>Document breaking changes and API</name>
    <files>server-v2/README.md, BREAKING_CHANGES.md</files>
    <action>
      1. Create server-v2/README.md:
         - Architecture overview
         - Module descriptions
         - Configuration options
         - Development instructions
      2. Create BREAKING_CHANGES.md:
         - API endpoint changes (companions → personas, projects)
         - WebSocket message format changes
         - Database format change (SQLite, no migration)
         - Hook event processing changes
      3. Update main README if needed
    </action>
    <verify>
      Review documentation for completeness
    </verify>
    <done>Breaking changes documented for client developers</done>
  </task>
</plan>

## Verification Criteria
- [ ] Integration tests pass
- [ ] Deployment scripts work
- [ ] Service can start/stop cleanly
- [ ] Documentation is complete
- [ ] Breaking changes documented
- [ ] Ready for client v2 development
