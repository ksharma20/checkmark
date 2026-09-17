# Security Policy

## Reporting a vulnerability

Please **do not** report security vulnerabilities through public GitHub issues,
discussions or pull requests.

Report them privately, in either of these ways:

- **GitHub private vulnerability reporting** - on
  [`ksharma20/checkmark`](https://github.com/ksharma20/checkmark), open the
  **Security** tab and choose **Report a vulnerability**.
- **Email** - kabir.innovate@gmail.com, with a subject starting `[security]`.

## What to include

The more of this you can give, the faster the issue can be confirmed:

- what the vulnerability is and what an attacker could do with it
- the affected route, file or component
- steps to reproduce, or a proof of concept
- the commit or deployment you tested against
- whether the issue is already public or known to anyone else

Please test only against your own local or self-hosted instance. Do not access,
modify or delete other people's data on the hosted instance at
https://checkmark.kabirinnovations.com, and do not run automated scanners or
load tests against it.

## What to expect

CheckMark is maintained by a single maintainer on a best-effort basis, so there
are no guaranteed response times. What you can expect:

- an acknowledgement, usually within a week
- an honest assessment of whether and how the issue will be fixed
- a fix on `main` as soon as is practical for confirmed issues, prioritised by severity
- credit in the fix or release notes, if you would like it

Please give reasonable time for a fix before disclosing the issue publicly.

## Supported versions

Only the latest `main` is supported. There are no maintained release branches;
security fixes land on `main`. If you run a self-hosted instance, keep it up to
date with `main`.

Known, already-documented security gaps are tracked in
[`CLAUDE.md`](CLAUDE.md) and [`docs/known-gaps.md`](docs/known-gaps.md) - you do
not need to report those, but ideas for fixing them are welcome as issues or pull
requests.
