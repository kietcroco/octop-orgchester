# Directory Structure

```
.github/
  assets/
    agent-runtime.svg (150 lines)
    architecture-topology.svg (258 lines)
    ci-invariants.svg (143 lines)
    flow-pattern.svg (133 lines)
    flow-run-lifecycle.svg (164 lines)
    social-preview.svg (168 lines)
    teams-pattern.svg (270 lines)
  ISSUE_TEMPLATE/
    bug_report.yml (115 lines)
    config.yml (11 lines)
    feature_request.yml (83 lines)
  workflows/
    ci.yml (98 lines)
    codeql.yml (49 lines)
    dco.yml (37 lines)
    gitleaks.yml (36 lines)
    labeler.yml (21 lines)
    release-please.yml (32 lines)
    release.yml (62 lines)
  .release-please-manifest.json (3 lines)
  CODE_OF_CONDUCT.md (48 lines)
  CODEOWNERS (37 lines)
  DCO.txt (34 lines)
  dependabot.yml (62 lines)
  FUNDING.yml (16 lines)
  labeler.yml (100 lines)
  LAUNCH_CHECKLIST.md (86 lines)
  PULL_REQUEST_TEMPLATE.md (51 lines)
  release-please-config.json (32 lines)
  release.yml (72 lines)
  SUPPORT.md (62 lines)
.husky/
  commit-msg (4 lines)
  pre-commit (31 lines)
apps/
  web/
    __mocks__/
      server-only.ts (2 lines)
    __tests__/
      e2e/
        onboarding-wizard.spec.ts (200 lines)
      helpers/
        zip.ts (92 lines)
      .gitkeep (0 lines)
      activity-client.test.tsx (243 lines)
      activity-csv.test.ts (106 lines)
      activity-filters.test.ts (251 lines)
      activity-merge.test.ts (111 lines)
      activity-routes.test.ts (239 lines)
      activity-sidebar.test.tsx (39 lines)
      activity-totals.test.ts (138 lines)
      activity-view.test.ts (141 lines)
      agent-admin-config-lock.test.ts (64 lines)
      agent-handoff.test.ts (309 lines)
      agent-knowledge-bases.test.ts (161 lines)
      agents-patch-knowledge-bases.test.ts (107 lines)
      allowlist.test.ts (121 lines)
      api-key-scopes.test.ts (119 lines)
      approve-route.test.ts (86 lines)
      attachment-table.test.ts (218 lines)
      audit-in-tx.test.ts (63 lines)
      channel-discord-webhook.test.ts (318 lines)
      channel-discord.test.ts (387 lines)
      channel-router-failed-metering.test.ts (194 lines)
      channel-router-flow-disabled.test.ts (79 lines)
      channel-update.test.ts (64 lines)
      channel-webhooks.test.ts (181 lines)
      channels-config-ui.test.ts (102 lines)
      charge-for.test.ts (76 lines)
      copilot-cut-off.test.ts (115 lines)
      cut-off-reply.test.ts (46 lines)
      dashboard-client.test.tsx (193 lines)
      db-queries.test.ts (63 lines)
      described-action-effect.test.ts (54 lines)
      developer-delete-scopes.test.tsx (40 lines)
      discord-connector.test.ts (117 lines)
      encryption.test.ts (61 lines)
      flow-delete-route.test.ts (202 lines)
      flow-engine-action-contract.test.ts (71 lines)
      flow-engine-agent-tools.test.ts (304 lines)
      flow-engine-done.test.ts (166 lines)
      flow-engine-groups.test.ts (160 lines)
      flow-engine-harness.ts (151 lines)
      flow-engine-llm-temperature.test.ts (86 lines)
      flow-engine-memdb.ts (98 lines)
      flow-engine-retry.test.ts (273 lines)
      flow-engine-step-trace.test.ts (114 lines)
      flow-engine-subflow-depth.test.ts (131 lines)
      flow-engine-subflow-io.test.ts (195 lines)
      flow-engine-subflow-output.test.ts (64 lines)
      flow-engine-subflow-status.test.ts (108 lines)
      flow-engine-tool-calls.test.ts (125 lines)
      flow-engine-usage-attribution.test.ts (69 lines)
      flow-engine.test.ts (96 lines)
      flow-extract-equivalence.test.ts (293 lines)
      flow-extract-route.test.ts (82 lines)
      flow-extract-service.test.ts (259 lines)
      flow-groups-routes.test.ts (82 lines)
      flow-kind-routes.test.ts (69 lines)
      flow-repo-sql.test.ts (106 lines)
      flow-restore-route-contract.test.ts (69 lines)
      flow-run-gate-engine.test.ts (170 lines)
      flow-run-gate-entrypoints.test.ts (190 lines)
      flow-run-steps-trace-api.test.ts (63 lines)
      flow-runs-panel-trace.test.tsx (99 lines)
      flow-service-guc.test.ts (55 lines)
      flow-service.test.ts (572 lines)
      flow-webhooks-route.test.ts (48 lines)
      gitlab-agent-tools.test.ts (121 lines)
      gitlab-connector.test.ts (1104 lines)
      html-text.test.ts (38 lines)
      i18n-routing.test.ts (18 lines)
      in-memory-rate-limiter.test.ts (115 lines)
      integration-action-effects.test.ts (80 lines)
      invites-route-email-status.test.ts (81 lines)
      llm-bedrock.test.ts (312 lines)
      llm-message-cache.test.ts (224 lines)
      llm-output-limit.test.ts (150 lines)
      mcp-admin-tools.test.ts (530 lines)
      mcp-client.test.ts (199 lines)
      mcp-flow-tools.test.ts (718 lines)
      mcp-integration-api.test.ts (116 lines)
      mcp-run-flow-dry-run.test.ts (29 lines)
      mcp-tools.test.ts (232 lines)
      middleware.test.ts (27 lines)
      mnemo-audit-endpoint.test.ts (72 lines)
      mnemo-client-binding.test.ts (41 lines)
      mnemo-decision-bom-endpoint.test.ts (55 lines)
      models-dev-check.test.ts (124 lines)
      motion.test.ts (36 lines)
      net-guard.test.ts (211 lines)
      newrelic-agent-tools.test.ts (67 lines)
      newrelic-connector.test.ts (127 lines)
      node-nature-badge.test.tsx (45 lines)
      observability-sentry.test.ts (113 lines)
      odoo-agent-tools.test.ts (275 lines)
      odoo-agent-write-scope.test.ts (290 lines)
      odoo-attachment-table.test.ts (215 lines)
      odoo-case-tools.test.ts (279 lines)
      odoo-connector.test.ts (612 lines)
      odoo-embedded-attachments.test.ts (191 lines)
      odoo-embedded-images.test.ts (78 lines)
      odoo-post-note-marker.test.ts (195 lines)
      odoo-tool-images.test.ts (97 lines)
      onboarding-actions.test.ts (21 lines)
      parallel-node.test.tsx (33 lines)
      phase-f1-tool-loop-tx.test.ts (268 lines)
      phase-f2-flow-engine-rls.test.ts (260 lines)
      phase-f4-signed-download.test.ts (236 lines)
      phase-f5-streaming-size-guard.test.ts (439 lines)
      pick-available-model.test.ts (58 lines)
      place.test.ts (147 lines)
      presentation-mode.test.tsx (48 lines)
      pricing-model-ids.test.ts (100 lines)
      promptQuality.test.ts (24 lines)
      provider-test-bedrock.test.ts (209 lines)
      public-channel-memory.test.ts (17 lines)
      README.md (15 lines)
      recall-debug-traceid.test.ts (27 lines)
      record-ai-usage.test.ts (252 lines)
      signup-policy.test.ts (53 lines)
      spreadsheet-code-execution-gate.test.ts (20 lines)
      stripe-webhook-signature.test.ts (113 lines)
      telegram-connector.test.ts (131 lines)
      telegram-webhook-secret.test.ts (64 lines)
      test-email-route.test.ts (52 lines)
      tool-call-execute.test.ts (162 lines)
      tool-call-log.test.ts (360 lines)
      tool-call-sources.test.ts (200 lines)
      tool-effect.test.ts (90 lines)
      tool-images-runtime.test.ts (318 lines)
      tool-loop-cap.test.ts (341 lines)
      tool-output.test.ts (52 lines)
      tool-result-images.test.ts (178 lines)
      usage-compaction.test.ts (79 lines)
      usage-routes.test.ts (118 lines)
      usage-runtime-router.test.ts (312 lines)
      widget-public-limits.test.ts (121 lines)
    app/
      [locale]/
        (auth)/
          login/
            page.tsx (6 lines)
          signup/
            page.tsx (6 lines)
          layout.tsx (78 lines)
        [workspaceSlug]/
          (shell)/
            activity/
              page.tsx (37 lines)
            agents/
              page.tsx (30 lines)
            brain/
              [factId]/
                page.tsx (7 lines)
              diff/
                DiffClient.tsx (147 lines)
                page.tsx (6 lines)
              export/
                ExportClient.tsx (232 lines)
                page.tsx (6 lines)
              graph/
                page.tsx (21 lines)
              review/
                page.tsx (10 lines)
                ReviewClient.tsx (305 lines)
              timeline/
                page.tsx (7 lines)
                TimelineClient.tsx (129 lines)
              undo/
                page.tsx (6 lines)
                UndoClient.tsx (261 lines)
              BrainInspectorClient.tsx (585 lines)
              FactDetailClient.tsx (363 lines)
              page.tsx (8 lines)
            channels/
              page.tsx (44 lines)
            conversations/
              [id]/
                page.tsx (124 lines)
              page.tsx (32 lines)
            employees/
              page.tsx (38 lines)
            flows/
              FlowsListClient.test.tsx (178 lines)
              FlowsListClient.tsx (469 lines)
              page.tsx (50 lines)
            integrations/
              page.tsx (20 lines)
            knowledge/
              [id]/
                page.tsx (52 lines)
              page.tsx (32 lines)
            org/
              page.tsx (17 lines)
            settings/
              memory/
                MemoryOpsClient.tsx (862 lines)
                page.tsx (43 lines)
              page.tsx (62 lines)
            teams/
              [id]/
                page.tsx (52 lines)
              page.tsx (66 lines)
            usage/
              page.tsx (10 lines)
            error.tsx (52 lines)
            layout.tsx (116 lines)
            loading.tsx (37 lines)
            page.tsx (87 lines)
          agents/
            [id]/
              page.tsx (53 lines)
          flows/
            [id]/
              page.tsx (39 lines)
        approve/
          [token]/
            page.tsx (60 lines)
        checkout/
          page.tsx (30 lines)
        deleted/
          [id]/
            page.tsx (128 lines)
        invite/
          [token]/
            page.tsx (51 lines)
        onboarding/
          page.tsx (73 lines)
        showcase/
          empty/
            page.tsx (67 lines)
          loading/
            page.tsx (64 lines)
        workspaces/
          page.tsx (82 lines)
        error.tsx (52 lines)
        layout.tsx (26 lines)
        loading.tsx (31 lines)
        not-found.tsx (33 lines)
        page.tsx (33 lines)
      actions/
        first-mile-onboarding.ts (92 lines)
        onboarding.ts (75 lines)
      api/
        admin/
          health-detailed/
            route.ts (147 lines)
          orgs/
            [orgId]/
              cross-workspace-facts/
                route.ts (153 lines)
          tenant-telemetry/
            route.ts (30 lines)
          test-email/
            route.ts (61 lines)
        agents/
          [id]/
            generate-prompt/
              route.ts (90 lines)
            memory/
              route.ts (68 lines)
            memory-policy/
              route.ts (127 lines)
            test-chat/
              route.ts (86 lines)
            test-chat-stream/
              route.ts (148 lines)
            versions/
              [vid]/
                restore/
                  route.ts (53 lines)
              route.ts (68 lines)
            route.ts (147 lines)
          route.ts (76 lines)
        ai/
          models/
            route.ts (69 lines)
        api-keys/
          [id]/
            route.ts (30 lines)
          route.ts (91 lines)
        approvals/
          [token]/
            route.ts (95 lines)
        audit-logs/
          route.ts (23 lines)
        auth/
          [...all]/
            route.ts (4 lines)
        billing/
          checkout/
            route.ts (42 lines)
          portal/
            route.ts (39 lines)
          usage/
            route.ts (26 lines)
          webhook/
            route.ts (125 lines)
        channels/
          [id]/
            route.ts (256 lines)
          discord/
            webhook/
              [secret]/
                route.ts (227 lines)
          slack/
            webhook/
              [secret]/
                route.ts (151 lines)
          telegram/
            webhook/
              [secret]/
                route.ts (100 lines)
          route.ts (71 lines)
        compass/
          whats-new/
            route.ts (22 lines)
        conversation-labels/
          [id]/
            route.ts (26 lines)
          route.ts (44 lines)
        conversations/
          [id]/
            reply/
              route.ts (134 lines)
            sensitivity/
              route.ts (73 lines)
            takeover/
              route.ts (61 lines)
            route.ts (71 lines)
          route.ts (91 lines)
        embed/
          route.ts (70 lines)
        employees/
          [id]/
            agents/
              route.ts (32 lines)
            budget/
              route.ts (48 lines)
        exports/
          [token]/
            route.ts (73 lines)
        flow-runs/
          [id]/
            route.ts (18 lines)
        flow-templates/
          route.ts (27 lines)
        flows/
          [id]/
            copilot/
              route.ts (147 lines)
            delete-impact/
              route.ts (17 lines)
            describe/
              route.ts (26 lines)
            extract/
              route.ts (35 lines)
            run/
              route.ts (38 lines)
            run-stream/
              route.ts (87 lines)
            runs/
              route.ts (18 lines)
            schedules/
              [wid]/
                route.ts (72 lines)
              route.ts (68 lines)
            versions/
              [vid]/
                restore/
                  route.ts (78 lines)
              route.ts (82 lines)
            webhooks/
              [wid]/
                route.ts (60 lines)
              route.ts (50 lines)
            route.ts (113 lines)
          seed-real/
            route.ts (403 lines)
          spreadsheet-preview/
            route.ts (39 lines)
          route.ts (55 lines)
        health/
          route.ts (67 lines)
        integrations/
          [id]/
            route.ts (83 lines)
          route.ts (61 lines)
        invites/
          accept/
            route.ts (78 lines)
          route.ts (139 lines)
        knowledge-bases/
          [id]/
            docs/
              [did]/
                route.ts (51 lines)
              route.ts (217 lines)
            search/
              route.ts (80 lines)
            route.ts (93 lines)
          route.ts (72 lines)
        mcp/
          route.ts (150 lines)
        me/
          active-workspace/
            route.ts (55 lines)
          delete/
            route.ts (177 lines)
          export/
            route.ts (196 lines)
          workspaces/
            route.ts (52 lines)
          route.ts (72 lines)
        mnemo/
          admin/
            run-auto-pin/
              route.ts (38 lines)
            run-consolidation/
              route.ts (44 lines)
            run-dedup/
              route.ts (38 lines)
            run-health/
              route.ts (44 lines)
            run-prune/
              route.ts (38 lines)
            run-review-sweep/
              route.ts (39 lines)
          audit/
            route.ts (73 lines)
          decisions/
            [traceId]/
              route.ts (167 lines)
          entities/
            [id]/
              facts/
                route.ts (52 lines)
              route.ts (144 lines)
            route.ts (121 lines)
          episodes/
            [id]/
              route.ts (48 lines)
            route.ts (68 lines)
          export/
            route.ts (86 lines)
          facts/
            [id]/
              citations/
                route.ts (35 lines)
              forget/
                route.ts (48 lines)
              pin/
                route.ts (53 lines)
              restore/
                route.ts (46 lines)
              unpin/
                route.ts (48 lines)
              route.ts (119 lines)
            route.ts (107 lines)
          health/
            history/
              route.ts (61 lines)
            latest/
              route.ts (67 lines)
          review/
            [id]/
              resolve/
                route.ts (86 lines)
            count/
              route.ts (35 lines)
            route.ts (57 lines)
          settings/
            route.ts (222 lines)
        notification-prefs/
          route.ts (143 lines)
        org-graph/
          route.ts (209 lines)
        providers/
          [id]/
            test/
              route.ts (47 lines)
            route.ts (44 lines)
          route.ts (142 lines)
        sessions/
          route.ts (98 lines)
        teams/
          [id]/
            route.ts (37 lines)
          route.ts (31 lines)
        tools/
          route.ts (35 lines)
        v1/
          agents/
            route.ts (37 lines)
          flows/
            route.ts (27 lines)
        webhooks/
          [secret]/
            route.ts (141 lines)
        webhooks-out/
          [id]/
            deliveries/
              route.ts (38 lines)
            route.ts (96 lines)
          events/
            route.ts (10 lines)
          route.ts (65 lines)
        widget/
          [channelId]/
            messages/
              route.ts (74 lines)
            stream/
              route.ts (122 lines)
        workspace-members/
          route.ts (167 lines)
        workspaces/
          [slug]/
            activity/
              export/
                route.ts (91 lines)
              route.ts (71 lines)
            audit/
              verify/
                route.ts (59 lines)
              route.ts (97 lines)
            brain/
              graph/
                route.ts (69 lines)
            export/
              [jobId]/
                route.ts (95 lines)
              route.ts (85 lines)
            feature-flags/
              [key]/
                route.ts (68 lines)
              route.ts (48 lines)
            restore/
              route.ts (88 lines)
            suspend/
              route.ts (137 lines)
            transfer/
              route.ts (231 lines)
            route.ts (202 lines)
          route.ts (147 lines)
      widget/
        [channelId]/
          page.tsx (52 lines)
      .gitkeep (0 lines)
      global-error.tsx (91 lines)
      globals.css (143 lines)
      layout.tsx (40 lines)
    components/
      activity/
        ActivityClient.tsx (786 lines)
      agents/
        studio/
          AgentConfigPanel.tsx (534 lines)
          AgentStudio.tsx (349 lines)
          MemoryPanel.tsx (181 lines)
          ModelPicker.test.tsx (136 lines)
          ModelPicker.tsx (234 lines)
          PromptEditor.test.tsx (54 lines)
          PromptEditor.tsx (80 lines)
          PromptGeneratorModal.tsx (208 lines)
          promptQuality.ts (29 lines)
          TemplatePickerModal.tsx (84 lines)
          templates.ts (182 lines)
          TestChat.test.tsx (69 lines)
          TestChat.tsx (329 lines)
          VersionHistory.tsx (120 lines)
        AgentFormModal.tsx (318 lines)
        AgentRow.tsx (182 lines)
        AgentsPageClient.tsx (621 lines)
      ai/
        ConnectProviderModal.tsx (170 lines)
        ModelPicker.tsx (143 lines)
      approvals/
        ApprovalClient.tsx (154 lines)
      auth/
        AgentOrgChart.tsx (173 lines)
        InviteAcceptClient.tsx (73 lines)
        LoginForm.tsx (266 lines)
        NeuralBackground.tsx (90 lines)
        SignupForm.tsx (193 lines)
      billing/
        CheckoutLauncher.tsx (51 lines)
        PricingCta.tsx (130 lines)
      brain/
        graph/
          BrainGraph.tsx (880 lines)
          BrainGraphECharts.tsx (287 lines)
          BrainGraphEmptyState.tsx (29 lines)
          BrainGraphFilters.tsx (260 lines)
          BrainGraphLegend.tsx (72 lines)
          BrainGraphNodeDetail.tsx (302 lines)
          BrainGraphViewToggle.tsx (60 lines)
        BrainStats.tsx (148 lines)
        CitationsList.tsx (84 lines)
        DiffColumn.tsx (93 lines)
        EditFactDialog.tsx (133 lines)
        FactFilters.tsx (220 lines)
        FactRow.tsx (328 lines)
        HealthDashboard.tsx (221 lines)
        MemoryEmptyOnboarding.tsx (169 lines)
        MemoryHeartbeat.tsx (148 lines)
        MemoryOnboardingWizard.tsx (286 lines)
        SensitivityToggle.tsx (136 lines)
        TimelineDayGroup.tsx (132 lines)
        TimeTravelPicker.tsx (101 lines)
      channels/
        ChannelsClient.tsx (1020 lines)
        WidgetChat.tsx (280 lines)
      common/
        NoProviderBanner.tsx (64 lines)
      compass/
        __tests__/
          ConfirmAction.test.tsx (162 lines)
          template-icons.test.ts (68 lines)
          TemplatePicker.test.tsx (82 lines)
          term-def-controller.test.ts (138 lines)
          TourProvider.test.tsx (223 lines)
        Callout.tsx (212 lines)
        CommandBar.tsx (777 lines)
        CommandBarRoot.tsx (86 lines)
        ConfirmAction.tsx (565 lines)
        EmptyState.tsx (225 lines)
        HelpButton.tsx (84 lines)
        HelpDrawer.tsx (527 lines)
        HelpRoot.tsx (23 lines)
        NextStep.tsx (247 lines)
        PageHero.tsx (210 lines)
        TemplatePicker.tsx (262 lines)
        TermDef.tsx (307 lines)
        TourProvider.tsx (679 lines)
        TourSpot.test.tsx (143 lines)
        TourSpot.tsx (339 lines)
      conversations/
        ConversationRow.tsx (130 lines)
        ConversationsClient.tsx (816 lines)
      dashboard/
        ConversationChart.tsx (96 lines)
        DashboardClient.tsx (1251 lines)
        DashboardClientLazy.tsx (36 lines)
        KpiCard.tsx (122 lines)
      employees/
        EmployeeTable.tsx (169 lines)
      flows/
        inspector/
          InspectorForm.test.tsx (79 lines)
          InspectorForm.tsx (715 lines)
          SpreadsheetField.tsx (297 lines)
        nodes/
          BranchNode.tsx (174 lines)
          GroupNode.test.tsx (93 lines)
          GroupNode.tsx (234 lines)
          icon-map.test.ts (11 lines)
          icon-map.ts (76 lines)
          RegistryNode.tsx (42 lines)
          SimpleNode.tsx (72 lines)
        CopilotPanel.tsx (274 lines)
        DeleteFlowDialog.test.tsx (143 lines)
        DeleteFlowDialog.tsx (164 lines)
        ExtractDialog.test.tsx (157 lines)
        ExtractDialog.tsx (312 lines)
        FlowBuilder.groups.test.tsx (302 lines)
        FlowBuilder.tsx (1855 lines)
        FlowBuilderLazy.tsx (29 lines)
        FlowDocsPanel.test.tsx (28 lines)
        FlowDocsPanel.tsx (95 lines)
        FlowKindPanel.test.tsx (89 lines)
        FlowKindPanel.tsx (201 lines)
        FlowRelations.test.tsx (141 lines)
        FlowRelations.tsx (226 lines)
        FlowRunsPanel.tsx (224 lines)
        group-view.test.ts (177 lines)
        group-view.ts (228 lines)
        GroupDialog.test.tsx (71 lines)
        GroupDialog.tsx (196 lines)
        node-mapping.test.ts (27 lines)
        node-mapping.ts (53 lines)
        NodePalette.tsx (120 lines)
      integrations/
        IntegrationsClient.tsx (379 lines)
      knowledge/
        KnowledgeDetailClient.tsx (334 lines)
        KnowledgeListClient.tsx (346 lines)
      onboarding/
        first-mile/
          AgentStep.tsx (265 lines)
          DoneStep.tsx (86 lines)
          OnboardingWizard.tsx (303 lines)
          ProviderStep.tsx (139 lines)
          SessionExpiredAlert.tsx (47 lines)
          Stepper.tsx (52 lines)
          TalkStep.tsx (169 lines)
          types.ts (72 lines)
          WelcomeStep.tsx (116 lines)
        steps/
          ApiKeyStep.tsx (88 lines)
          EmployeesStep.tsx (102 lines)
          TemplateStep.tsx (99 lines)
          WelcomeStep.tsx (101 lines)
        OnboardingChecklist.test.tsx (67 lines)
        OnboardingChecklist.tsx (225 lines)
        OnboardingProgress.tsx (63 lines)
        OnboardingWizard.tsx (137 lines)
      org/
        OrgCanvas.tsx (711 lines)
        OrgCanvasLazy.tsx (29 lines)
        OrgChart.tsx (300 lines)
      providers/
        PresentationModeProvider.tsx (34 lines)
        Providers.tsx (47 lines)
        SentryClientInit.tsx (28 lines)
      settings/
        _layout.tsx (135 lines)
        AccountSection.tsx (220 lines)
        AIProvidersSection.tsx (716 lines)
        AuditLogSection.tsx (159 lines)
        BillingSection.tsx (169 lines)
        DangerZoneSection.tsx (90 lines)
        DevelopersSection.tsx (441 lines)
        GeneralSection.tsx (141 lines)
        MembersSection.test.tsx (64 lines)
        MembersSection.tsx (360 lines)
        NotificationsSection.tsx (93 lines)
        SessionsSection.tsx (170 lines)
        SettingsClient.tsx (267 lines)
        TwoFactorSection.tsx (253 lines)
      shell/
        CommandPalette.tsx (170 lines)
        LanguageSelector.tsx (62 lines)
        PresentationModeToggle.tsx (36 lines)
        Sidebar.tsx (171 lines)
        SidebarItem.tsx (66 lines)
        ThemeToggle.tsx (57 lines)
        Topbar.tsx (71 lines)
        UserMenu.tsx (204 lines)
      teams/
        TeamCard.tsx (118 lines)
        TeamDetailClient.tsx (352 lines)
        TeamFormModal.tsx (189 lines)
        TeamsPageClient.tsx (38 lines)
      ui/
        ConfirmDialog.tsx (133 lines)
        EmptyState.tsx (78 lines)
        Markdown.test.tsx (64 lines)
        Markdown.tsx (96 lines)
      usage/
        UsagePageClient.tsx (327 lines)
      workspace/
        hooks/
          useMyWorkspaces.ts (41 lines)
        AuditLogViewer.tsx (213 lines)
        CreateWorkspaceModal.tsx (180 lines)
        DeletedWorkspaceRestoreCard.tsx (169 lines)
        FeatureFlagAdminPanel.tsx (160 lines)
        GdprExportProgress.tsx (302 lines)
        SoftDeleteWorkspaceModal.tsx (176 lines)
        SuspendedBanner.tsx (46 lines)
        TransferOwnershipModal.tsx (263 lines)
        WorkspaceAvatar.tsx (50 lines)
        WorkspaceMenu.tsx (182 lines)
        WorkspaceSwitcher.tsx (77 lines)
      .gitkeep (0 lines)
    i18n/
      .gitkeep (0 lines)
      request.ts (20 lines)
      routing.ts (7 lines)
    lib/
      activity/
        csv.ts (94 lines)
        filters.ts (217 lines)
        merge.ts (37 lines)
        query.ts (959 lines)
        tool-calls.ts (320 lines)
        totals.ts (138 lines)
        types.ts (194 lines)
        view.ts (123 lines)
      agent-tools/
        mnemosyne-remember.ts (197 lines)
      agents/
        admin-service.ts (133 lines)
        cut-off-reply.ts (40 lines)
        delete-impact.ts (55 lines)
        knowledge-bases.test.ts (17 lines)
        knowledge-bases.ts (78 lines)
        schemas.test.ts (34 lines)
        schemas.ts (39 lines)
        tool-call-cap.ts (42 lines)
      ai/
        adapters/
          avatar.ts (150 lines)
          embeddings.ts (64 lines)
          images.ts (279 lines)
          media.ts (216 lines)
          ocr.ts (33 lines)
          rerank.ts (47 lines)
        catalog/
          catalog.test.ts (73 lines)
          index.ts (107 lines)
          models.ts (493 lines)
          providers.ts (794 lines)
          types.ts (127 lines)
        capabilities.ts (212 lines)
        credentials.ts (54 lines)
        embedding-tier.ts (215 lines)
        output-limit.ts (22 lines)
        run.ts (509 lines)
      api-auth/
        key.ts (71 lines)
        scopes.ts (92 lines)
      audit/
        chain.ts (55 lines)
        index.ts (9 lines)
        log.ts (156 lines)
        types.ts (57 lines)
        verify-job.ts (98 lines)
        verify.ts (83 lines)
      billing/
        plans.ts (85 lines)
        quotas.ts (206 lines)
        stripe-signature.ts (50 lines)
        stripe.ts (86 lines)
      channels/
        allowlist.ts (50 lines)
        config.ts (48 lines)
        discord.ts (420 lines)
        place.ts (76 lines)
        public-channels.ts (10 lines)
        router.ts (962 lines)
        slack.ts (272 lines)
        telegram.ts (128 lines)
        widget-guard.ts (98 lines)
      compass/
        flow-templates.test.ts (119 lines)
        templates.ts (703 lines)
        term-def-controller.ts (244 lines)
        terms.ts (308 lines)
        use-has-tour.ts (71 lines)
        use-template-create-flow.ts (89 lines)
        whats-new.ts (150 lines)
      feature-flags/
        admin.ts (61 lines)
        cache.ts (65 lines)
        check.ts (39 lines)
        index.ts (6 lines)
      flows/
        action-contract.ts (49 lines)
        action-guard.ts (25 lines)
        admin-delete.ts (47 lines)
        agent-message.test.ts (25 lines)
        code-execution.ts (24 lines)
        copilot-tools.test.ts (66 lines)
        copilot-tools.ts (226 lines)
        delete-impact.ts (120 lines)
        describe-load.ts (54 lines)
        describe.test.ts (247 lines)
        describe.ts (194 lines)
        dry-run.ts (51 lines)
        extract-request.ts (35 lines)
        extract.test.ts (507 lines)
        extract.ts (669 lines)
        field-types.ts (61 lines)
        filters.test.ts (299 lines)
        filters.ts (322 lines)
        flow-calls.ts (50 lines)
        flow-repo.ts (182 lines)
        formula-library.ts (154 lines)
        group-by-status.test.ts (35 lines)
        group-by-status.ts (10 lines)
        groups.test.ts (163 lines)
        groups.ts (196 lines)
        interpolate.test.ts (35 lines)
        kind.test.ts (89 lines)
        kind.ts (55 lines)
        layout.ts (47 lines)
        node-docs.ts (494 lines)
        node-nature.test.ts (133 lines)
        node-nature.ts (152 lines)
        node-registry.test.ts (63 lines)
        node-registry.ts (1064 lines)
        node-types.ts (43 lines)
        normalize.test.ts (128 lines)
        normalize.ts (191 lines)
        notify-pause.ts (68 lines)
        pause.test.ts (72 lines)
        pause.ts (95 lines)
        payload.test.ts (187 lines)
        payload.ts (92 lines)
        relations-load.ts (50 lines)
        relations.test.ts (120 lines)
        relations.ts (145 lines)
        resume.ts (104 lines)
        retry.test.ts (123 lines)
        retry.ts (144 lines)
        run-gate.ts (43 lines)
        run-inputs.test.ts (32 lines)
        run-inputs.ts (30 lines)
        service.ts (661 lines)
        spreadsheet-core.ts (141 lines)
        spreadsheet.test.ts (37 lines)
        spreadsheet.ts (21 lines)
        subflow-io.ts (126 lines)
        templates.test.ts (108 lines)
        templates.ts (199 lines)
        validate-stored.test.ts (357 lines)
        validate-stored.ts (209 lines)
        validate.test.ts (102 lines)
        validate.ts (153 lines)
        variable-facts.ts (152 lines)
        versions.test.ts (109 lines)
        versions.ts (70 lines)
      gdpr/
        exporters/
          agents.ts (60 lines)
          conversations.ts (29 lines)
          knowledge.ts (54 lines)
          messages.ts (53 lines)
          workspace.ts (47 lines)
        email.ts (120 lines)
        export-job.ts (272 lines)
        redact.ts (126 lines)
        signed-url.ts (83 lines)
        storage.ts (267 lines)
        watchdog.ts (68 lines)
      hooks/
        use-brain-diff.ts (191 lines)
        use-brain-facts.ts (294 lines)
        use-brain-graph.ts (70 lines)
        use-brain-health.ts (83 lines)
        use-brain-review-count.ts (57 lines)
        use-brain-timeline.ts (146 lines)
        use-entity-facts.ts (43 lines)
        use-graph-filters.ts (189 lines)
      integrations/
        attachment-table.ts (426 lines)
        discord-client.ts (114 lines)
        gitlab-client.ts (558 lines)
        html-text.ts (32 lines)
        mcp-client.ts (192 lines)
        mcp-policy.ts (97 lines)
        mcp-tools.ts (96 lines)
        newrelic-client.ts (241 lines)
        odoo-client.ts (220 lines)
        odoo-embedded-images.ts (53 lines)
        odoo-write-scope.ts (103 lines)
        registry.ts (2524 lines)
        resolve.test.ts (51 lines)
        resolve.ts (35 lines)
        store.ts (279 lines)
        telegram-client.ts (78 lines)
      mcp/
        admin-tools.ts (153 lines)
        flow-tools.ts (571 lines)
        server.ts (715 lines)
        stdio-bridge.mjs (79 lines)
      memory/
        graph-canvas/
          edge-canvas.ts (147 lines)
          index.ts (30 lines)
          layout.ts (18 lines)
          node-canvas.ts (353 lines)
          types.ts (43 lines)
        graph-analytics.ts (159 lines)
      mnemo/
        audit.ts (49 lines)
        bootstrap.ts (64 lines)
        client.ts (97 lines)
        entities.ts (121 lines)
        episodes.ts (51 lines)
        export.ts (38 lines)
        facts.ts (460 lines)
        graph.ts (36 lines)
        recall.ts (62 lines)
        review.ts (80 lines)
        warm-up.ts (106 lines)
      policy/
        agent-memory.ts (105 lines)
      rate-limit/
        in-memory-bucket.ts (71 lines)
      settings/
        mnemo.ts (177 lines)
      teams/
        service.ts (126 lines)
      tenant/
        cluster-cache.ts (187 lines)
        context.ts (128 lines)
        cron.ts (47 lines)
        guards.ts (25 lines)
        hard-delete-job.ts (84 lines)
        index.ts (22 lines)
        lifecycle.ts (215 lines)
        membership.ts (117 lines)
        middleware.ts (124 lines)
        query.ts (75 lines)
        resolve.ts (138 lines)
        telemetry.ts (47 lines)
        types.ts (43 lines)
      text/
        escape.test.ts (22 lines)
        escape.ts (31 lines)
        markdown-html.test.ts (333 lines)
        markdown-html.ts (467 lines)
      .gitkeep (0 lines)
      agent-runtime.ts (669 lines)
      api-response.ts (41 lines)
      audit.ts (68 lines)
      auth-client.ts (22 lines)
      auth-guards.ts (95 lines)
      auth.ts (119 lines)
      chunking.ts (83 lines)
      connector-tools.ts (60 lines)
      cookies.ts (152 lines)
      cost-alerts.ts (275 lines)
      db-queries.ts (1328 lines)
      db-role-check.ts (97 lines)
      email.ts (56 lines)
      embeddings.ts (158 lines)
      employee-budget.ts (161 lines)
      encryption.ts (250 lines)
      env.ts (104 lines)
      flow-engine.ts (1997 lines)
      html-escape.ts (9 lines)
      http-util.ts (157 lines)
      knowledge-search.ts (72 lines)
      llm-call.ts (1347 lines)
      memory-compaction.ts (158 lines)
      memory.ts (297 lines)
      middleware-utils.ts (34 lines)
      moderation.ts (117 lines)
      motion.ts (106 lines)
      net-guard.ts (358 lines)
      observability.ts (225 lines)
      pricing.ts (229 lines)
      providers.ts (242 lines)
      queue.ts (264 lines)
      rate-limit-redis.ts (93 lines)
      rate-limit.ts (146 lines)
      rbac.ts (201 lines)
      retention.ts (200 lines)
      safe-log.ts (63 lines)
      safe-return.ts (28 lines)
      signup-policy.ts (41 lines)
      slug.ts (10 lines)
      storage.ts (441 lines)
      toast.ts (10 lines)
      tool-output.ts (100 lines)
      tools.ts (1388 lines)
      usage-sql.ts (46 lines)
      use-api.ts (109 lines)
      utils.ts (6 lines)
      validation.ts (55 lines)
      webhooks-out.ts (242 lines)
      workspace-admin.ts (59 lines)
      workspace.ts (127 lines)
    lint-rules/
      check-tenant-filters.mjs (95 lines)
    messages/
      .gitkeep (0 lines)
      en.json (3076 lines)
      es.json (3076 lines)
      pt.json (3076 lines)
    scripts/
      backfill-mnemo-embeddings.ts (197 lines)
      backfill-seed-kb-direct.ts (715 lines)
      backfill-seed-kb.ts (523 lines)
      build-instrumentation.mjs (126 lines)
      capture-screenshots.mts (240 lines)
      check-models-dev.mjs (195 lines)
      e2e-recall-smoke.ts (113 lines)
      i18n-check.ts (172 lines)
      init-queues.ts (29 lines)
      preview-tour.mts (23 lines)
      reencrypt-credentials.ts (292 lines)
      rotate-encryption-secret.ts (106 lines)
      snap-via-sysevents.sh (163 lines)
    tests/
      factories/
        index.ts (60 lines)
      fixtures/
        workspaces.ts (170 lines)
      integration/
        activity/
          activity.spec.ts (638 lines)
        audit/
          log.spec.ts (187 lines)
          verify.spec.ts (66 lines)
        auth/
          signup-mode.spec.ts (86 lines)
        channels/
          router.spec.ts (248 lines)
        dashboard/
          command-center.spec.ts (387 lines)
        feature-flags/
          check.spec.ts (47 lines)
        gdpr/
          export-job.spec.ts (238 lines)
          watchdog.spec.ts (111 lines)
        onboarding/
          checklist-teammate.spec.ts (97 lines)
        tenant/
          cluster-cache.spec.ts (169 lines)
          lifecycle.spec.ts (136 lines)
          membership.spec.ts (55 lines)
          resolve.spec.ts (70 lines)
      isolation/
        db-scan.spec.ts (320 lines)
        helpers.ts (91 lines)
        injection-probes.spec.ts (80 lines)
        routes-static-audit.spec.ts (196 lines)
      unit/
        audit/
          chain.spec.ts (104 lines)
        brain/
          decay-math.spec.ts (48 lines)
          recall-scoring.spec.ts (85 lines)
        lifecycle/
          token-compare.spec.ts (53 lines)
        workspace/
          buildSwitchTarget.spec.ts (48 lines)
          gdpr-export-progress-state.spec.ts (114 lines)
          slugify.spec.ts (37 lines)
        cookies.spec.ts (124 lines)
        cost-alerts-fail-closed.spec.ts (119 lines)
        email-send.spec.ts (66 lines)
        embedding-tier.test.ts (309 lines)
        mnemo-client.test.ts (88 lines)
        rbac-system-admin.spec.ts (115 lines)
    types/
      css-imports.d.ts (6 lines)
    worker/
      build.mjs (40 lines)
      empty-module.cjs (2 lines)
      index.ts (206 lines)
    .eslintrc.json (14 lines)
    .gitignore (1 lines)
    instrumentation-node.ts (71 lines)
    instrumentation.ts (185 lines)
    middleware.ts (230 lines)
    next-env.d.ts (6 lines)
    next.config.ts (113 lines)
    package.json (120 lines)
    playwright.config.ts (35 lines)
    postcss.config.js (6 lines)
    sentry.client.config.ts (36 lines)
    tailwind.config.ts (140 lines)
    tsconfig.json (23 lines)
    vitest.config.ts (35 lines)
    vitest.setup.ts (16 lines)
  widget/
    package.json (6 lines)
deploy/
  Caddyfile (50 lines)
  docker-compose.prod.yml (274 lines)
  Dockerfile (96 lines)
docs/
  adr/
    0001-record-architecture-decisions.md (37 lines)
    0002-apache-2-0-over-mit.md (42 lines)
    0003-postgres-as-only-dependency.md (45 lines)
    0004-dco-over-cla.md (37 lines)
    0005-app-layer-tenancy.md (46 lines)
    0006-multi-tenancy-isolation.md (24 lines)
    0007-audit-log-hash-chain.md (27 lines)
    0008-workspace-slug-in-url.md (24 lines)
    0009-soft-delete-30-day-window.md (24 lines)
    0010-rls-force-defense-in-depth.md (75 lines)
    0011-active-workspace-cookie.md (24 lines)
    0012-cross-tenant-admin-wrapper.md (29 lines)
    0013-tenant-context-via-guc.md (27 lines)
    0014-brain-fact-format.md (34 lines)
    0015-brain-extraction-model.md (35 lines)
    0016-brain-recall-scoring.md (36 lines)
    0017-brain-single-table-embedding.md (32 lines)
    0018-brain-hnsw-over-ivfflat.md (34 lines)
    0019-brain-exponential-decay.md (43 lines)
    0020-mnemosyne-multi-tenant-memory.md (246 lines)
    README.md (56 lines)
  audits/
    2026-06-06-full-ui-audit.md (150 lines)
  runbooks/
    incident-response.md (110 lines)
    lifecycle-features-smoke.md (52 lines)
    tenant-context-verification.md (72 lines)
    workspace-switcher-verification.md (137 lines)
  specs/
    plans/
      2026-09-17-mcp-flow-management.md (4001 lines)
      phase-e-followups.md (70 lines)
    2026-05-23-tenant-hardening-design.md (2604 lines)
    2026-06-04-memory-graph-design.md (448 lines)
    2026-06-26-brain-graph-analytics-and-demo-seed.md (164 lines)
    2026-09-17-mcp-flow-management-design.md (305 lines)
  ARCHITECTURE.md (593 lines)
  AUDIT_PLAYBOOK.md (195 lines)
  COMPASS_VOICE.md (191 lines)
  dependency-licenses.md (31 lines)
  DEPLOY.md (326 lines)
  encryption-key-rotation.md (66 lines)
  MCP_CLIENT.md (40 lines)
  migrations.md (118 lines)
  PRODUCTION_CHECKLIST.md (193 lines)
  RUNBOOK.md (364 lines)
  UI-DESIGN-SYSTEM.md (241 lines)
packages/
  db/
    drizzle/
      _archive_stale_0000/
        meta/
          _journal.json (13 lines)
          0000_snapshot.json (1124 lines)
        0000_new_triathlon.sql (164 lines)
      meta/
        _journal.json (27 lines)
        0000_snapshot.json (4071 lines)
      0000_baseline.sql (589 lines)
      0001_indexes.sql (50 lines)
      0002_channel_type_discord.sql (9 lines)
    migrations/
      0001_workspace_lifecycle.down.sql (23 lines)
      0001_workspace_lifecycle.sql (35 lines)
      0002a_rename_legacy_audit_log.down.sql (9 lines)
      0002a_rename_legacy_audit_log.sql (23 lines)
      0002b_audit_log.down.sql (2 lines)
      0002b_audit_log.sql (36 lines)
      0002c_audit_log_data_migration.down.sql (3 lines)
      0002c_audit_log_data_migration.sql (43 lines)
      0003_feature_flags.down.sql (1 lines)
      0003_feature_flags.sql (17 lines)
      0004_gdpr_export_jobs.down.sql (2 lines)
      0004_gdpr_export_jobs.sql (28 lines)
      0005_idempotency_security.down.sql (2 lines)
      0005_idempotency_security.sql (28 lines)
      0006_rls_helpers.down.sql (2 lines)
      0006_rls_helpers.sql (15 lines)
      0007_postgres_roles.down.sql (14 lines)
      0007_postgres_roles.sql (32 lines)
      0008_rls_enable_no_force.down.sql (32 lines)
      0008_rls_enable_no_force.sql (153 lines)
      0009_rls_force_critical.down.sql (12 lines)
      0009_rls_force_critical.sql (31 lines)
      0010_rls_force_rest.down.sql (14 lines)
      0010_rls_force_rest.sql (32 lines)
      0011_rls_missing_tables.down.sql (30 lines)
      0011_rls_missing_tables.sql (68 lines)
      0012_fix_workspace_select_policy.down.sql (16 lines)
      0012_fix_workspace_select_policy.sql (22 lines)
      0013_rls_legacy_template.down.sql (40 lines)
      0013_rls_legacy_template.sql (101 lines)
      0014_workspace_owner_trigger.down.sql (9 lines)
      0014_workspace_owner_trigger.sql (56 lines)
      0015_idempotency_pk_scoped.down.sql (10 lines)
      0015_idempotency_pk_scoped.sql (38 lines)
      0016_brain_core.down.sql (11 lines)
      0016_brain_core.sql (101 lines)
      0017_mnemosyne_init.down.sql (5 lines)
      0017_mnemosyne_init.sql (91 lines)
      0018_mnemosyne_decision.down.sql (4 lines)
      0018_mnemosyne_decision.sql (59 lines)
      0020_mnemosyne_relation.down.sql (2 lines)
      0020_mnemosyne_relation.sql (46 lines)
      0021_mnemosyne_citation.down.sql (2 lines)
      0021_mnemosyne_citation.sql (27 lines)
      0022_mnemosyne_query_cache.down.sql (2 lines)
      0022_mnemosyne_query_cache.sql (28 lines)
      0024_brain_to_mnemo_backfill.down.sql (9 lines)
      0024_brain_to_mnemo_backfill.sql (47 lines)
      0025_brain_extraction_skip_state.down.sql (11 lines)
      0025_brain_extraction_skip_state.sql (20 lines)
      0026_mnemosyne_bitemporal_gist.down.sql (5 lines)
      0026_mnemosyne_bitemporal_gist.sql (27 lines)
      0027_mnemosyne_provider_health.down.sql (31 lines)
      0027_mnemosyne_provider_health.sql (74 lines)
      0028_mnemosyne_summary.down.sql (16 lines)
      0028_mnemosyne_summary.sql (83 lines)
      0029_mnemosyne_archive.down.sql (14 lines)
      0029_mnemosyne_archive.sql (79 lines)
      0031_mnemosyne_health.down.sql (12 lines)
      0031_mnemosyne_health.sql (75 lines)
      0032_mnemosyne_review_queue.down.sql (12 lines)
      0032_mnemosyne_review_queue.sql (68 lines)
      0033_mnemosyne_memory_types.down.sql (5 lines)
      0033_mnemosyne_memory_types.sql (40 lines)
      0034_mnemosyne_episode.down.sql (13 lines)
      0034_mnemosyne_episode.sql (87 lines)
      0035_mnemosyne_attribution.down.sql (3 lines)
      0035_mnemosyne_attribution.sql (26 lines)
      0036_mnemosyne_agent_memory_policy.down.sql (4 lines)
      0036_mnemosyne_agent_memory_policy.sql (33 lines)
      0037_mnemosyne_actor_id.down.sql (6 lines)
      0037_mnemosyne_actor_id.sql (27 lines)
      0038_conversation_sensitivity.down.sql (3 lines)
      0038_conversation_sensitivity.sql (23 lines)
      0039_mnemosyne_entity.down.sql (21 lines)
      0039_mnemosyne_entity.sql (115 lines)
      0040_mnemosyne_actor_isolation_policy.down.sql (3 lines)
      0040_mnemosyne_actor_isolation_policy.sql (62 lines)
      0041_mnemosyne_protocol_v12_tagging.down.sql (6 lines)
      0041_mnemosyne_protocol_v12_tagging.sql (34 lines)
      0042_mnemosyne_halfvec.down.sql (23 lines)
      0042_mnemosyne_halfvec.sql (68 lines)
      0043_mnemo_relation_provenance.down.sql (10 lines)
      0043_mnemo_relation_provenance.sql (63 lines)
      0044_mnemo_review_queue_decision_support.down.sql (5 lines)
      0044_mnemo_review_queue_decision_support.sql (43 lines)
      0045_mnemo_fact_memory_strength.down.sql (9 lines)
      0045_mnemo_fact_memory_strength.sql (50 lines)
      0046_mnemo_pointer_index.down.sql (6 lines)
      0046_mnemo_pointer_index.sql (55 lines)
      0047_mnemo_unresolved_mention.down.sql (2 lines)
      0047_mnemo_unresolved_mention.sql (114 lines)
      0048_mnemo_episode_first_class.down.sql (18 lines)
      0048_mnemo_episode_first_class.sql (65 lines)
      0049_org_primitive.down.sql (13 lines)
      0049_org_primitive.sql (103 lines)
      0050_mnemo_org_fact_view.down.sql (6 lines)
      0050_mnemo_org_fact_view.sql (72 lines)
      0051_mnemo_fact_episode_not_null.down.sql (10 lines)
      0051_mnemo_fact_episode_not_null.sql (71 lines)
      0052_mnemo_cron_schedule.down.sql (9 lines)
      0052_mnemo_cron_schedule.sql (128 lines)
      0053_drop_legacy_brain_residue.down.sql (11 lines)
      0053_drop_legacy_brain_residue.sql (68 lines)
      0054_pgboss_schema_grant.sql (29 lines)
      0055_flow_spec.sql (6 lines)
      0056_channel_type_discord.sql (6 lines)
      0057_api_key_explicit_scopes.sql (25 lines)
      0058_wait_human_pause_enum.sql (24 lines)
      0059_wait_human_pause_columns.sql (33 lines)
      0060_channel_allow_any_sender.sql (38 lines)
      0061_flow_step_trace.sql (18 lines)
      0062_flow_kind.sql (16 lines)
      0063_flow_groups.sql (18 lines)
      0064_tool_call.sql (95 lines)
      single-tenant-org-rls-off.sql (44 lines)
    scripts/
      audit-sql-migrations.mjs (209 lines)
      manifest.mjs (62 lines)
      migrations-excluidas.mjs (35 lines)
    sql/
      init-indices.sql (45 lines)
    src/
      __tests__/
        client.test.ts (14 lines)
        core-schema.test.ts (45 lines)
        schema.test.ts (39 lines)
      schema/
        activity.ts (47 lines)
        agent-tools.ts (49 lines)
        ai-providers.ts (73 lines)
        audit.ts (42 lines)
        auth.ts (81 lines)
        core.ts (226 lines)
        feature-flags.ts (25 lines)
        flows.ts (310 lines)
        gdpr.ts (41 lines)
        idempotency.ts (26 lines)
        index.ts (20 lines)
        integrations.ts (37 lines)
        knowledge.ts (113 lines)
        orgs.ts (25 lines)
        production.ts (176 lines)
        security.ts (21 lines)
        workspaces.ts (104 lines)
      client.ts (39 lines)
      index.ts (39 lines)
      seed-demo.ts (5170 lines)
      seed.ts (434 lines)
    drizzle.config.ts (10 lines)
    package.json (49 lines)
    tsconfig.json (9 lines)
scripts/
  audit-invariants.sh (164 lines)
  backup.sh (67 lines)
  generate-secrets.sh (40 lines)
  go-live.sh (107 lines)
  install-git-hooks.sh (45 lines)
  loadtest-test-chat.js (94 lines)
  preflight.sh (153 lines)
  provision.sh (114 lines)
  rotate-encryption-secret.sh (41 lines)
  setup-mnemo-workspace.sh (42 lines)
  smoke-test.sh (110 lines)
  verify-email.sh (100 lines)
.commitlintrc.mjs (38 lines)
.dockerignore (25 lines)
.editorconfig (29 lines)
.env.example (169 lines)
.gitattributes (81 lines)
.gitignore (50 lines)
.gitleaks.toml (55 lines)
.gitleaksignore (15 lines)
.nvmrc (1 lines)
.prettierignore (25 lines)
.prettierrc.json (28 lines)
AGENTS.md (47 lines)
CHANGELOG.md (507 lines)
CITATION.cff (30 lines)
CONTRIBUTING.md (195 lines)
docker-compose.yml (64 lines)
GOVERNANCE.md (85 lines)
LICENSE (201 lines)
Makefile (89 lines)
NOTICE (12 lines)
package.json (70 lines)
pnpm-workspace.yaml (13 lines)
railway.json (14 lines)
README.md (826 lines)
ROADMAP.md (105 lines)
SECURITY.md (81 lines)
tsconfig.base.json (18 lines)
turbo.json (21 lines)
```