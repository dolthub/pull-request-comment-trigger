#!/usr/bin/env node

const core = require("@actions/core");
const github = require("@actions/github");

const context = github.context;

async function run() {
    const trigger = core.getInput("trigger", { required: true });

    const reaction = core.getInput("reaction");
    const { GITHUB_TOKEN, GITHUB_RUN_ID } = process.env;
    if (reaction && !GITHUB_TOKEN) {
        core.setFailed('If "reaction" is supplied, GITHUB_TOKEN is required');
        return;
    }

    const body =
        context.eventName === "issue_comment"
            ? context.payload.comment.body
            : context.payload.pull_request.body;

    // handle cases by forcing body to lowercase
    const lowered = body.toLowerCase();
    core.setOutput('comment_body', lowered);

    if (
        context.eventName === "issue_comment" &&
        !context.payload.issue.pull_request
    ) {
        // not a pull-request comment, aborting
        core.setOutput("triggered", "false");
        return;
    }

    const { owner, repo } = context.repo;

    const prefixOnly = core.getInput("prefix_only") === 'true';
    if ((prefixOnly && !lowered.startsWith(trigger)) || !lowered.includes(trigger)) {
        core.setOutput("triggered", "false");
        return;
    }

    core.setOutput("triggered", "true");

    const client = github.getOctokit(GITHUB_TOKEN);
    const workflowLink = `https://github.com/${owner}/${repo}/actions/runs/${GITHUB_RUN_ID}`
    const issueNumber = context.eventName === "issue_comment" ? context.issue.number : context.payload.pull_request.number;

    await client.issues.createComment({
        issue_number: issueNumber,
        repo,
        owner,
        body: `@${context.actor} workflow run: ${workflowLink}`,
    });

    if (!reaction) {
        return;
    }

    if (context.eventName === "issue_comment") {
        await client.reactions.createForIssueComment({
            owner,
            repo,
            comment_id: context.payload.comment.id,
            content: reaction
        });
    } else {
        await client.reactions.createForIssue({
            owner,
            repo,
            issue_number: context.payload.pull_request.number,
            content: reaction
        });
    }
}

run().catch(err => {
    console.error(err);
    core.setFailed("Unexpected error");
});
