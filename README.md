# node-nuget-client

## What?
A NuGet client for Node

## Why?
I'd like to wrap a CLI nuget package with a node package
so I need a client

## Why the silly name?
Like so many npm package names, the most obvious / best one
(`nuget-client`) _was already taken, **and abandoned**_

## It's not complete tho?

Correct. Currently you can use the api or cli client to:
- query package info (cli: `node-nuget info <packageId>`)
- search for packages (cli: `node-nuget search [words...]`)
- download a package (cli: `node-nuget download <packageId>`)


## WHY IT TAKES SO LONG?!

Honestly, it's all up to the nuget api.

Because the nuget api is a web of indirections. To get to
downloading a package is (eventually) going to take 4
http calls. And I'm not (yet) even trying to resolve
dependencies.

For extra fun, packages which have a long history will
take even longer because the query interface doesn't seem
to allow asking a simple question like "what's the info
on the current version of package [X]". Instead, you have to
fetch the entire history of that package and trawl it.
So, in addition to multiple http latencies, you may
spend time downloading and parsing 65k of json just to get
a few hundred bytes of useful information. This client
caches what it can (and will cache more in the near future),
so perhaps some of that cost is mitigated; I think that
the official nuget clients bootstrap their package queries
from the top every time.
