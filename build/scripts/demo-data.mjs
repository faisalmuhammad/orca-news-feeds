export const rss = (now = Date.now()) =>
  '<rss version="2.0"><channel><title>Field Notes</title><link>https://example.org</link>' +
  [
    [
      "Building software that gives you room to think",
      "A thoughtful look at quiet interfaces, useful defaults, and knowing when to get out of the way.",
      "https://example.org/quiet-software",
      42,
    ],
    [
      "What we learned from simplifying our build pipeline",
      "Fewer steps, clearer feedback, and a much faster path from an idea to a running application.",
      "https://example.org/builds",
      160,
    ],
    [
      "Designing for the moments when the network disappears",
      "Cached startup and honest freshness indicators can make an offline experience feel surprisingly normal.",
      "https://example.org/offline",
      340,
    ],
    [
      "The small details that make a tool feel finished",
      "Keyboard focus, good empty states, and a reading experience that holds up in a narrow window.",
      "https://example.org/details",
      520,
    ],
  ]
    .map(
      ([title, summary, url, min], i) =>
        '<item><guid isPermaLink="false">field-' +
        i +
        "</guid><title>" +
        title +
        "</title><link>" +
        url +
        "</link><description>" +
        summary +
        "</description><pubDate>" +
        new Date(now - min * 60000).toUTCString() +
        "</pubDate><author>Field Notes</author></item>",
    )
    .join("") +
  "</channel></rss>";
export const atom = (now = Date.now()) =>
  '<feed xmlns="http://www.w3.org/2005/Atom"><title>r/programming</title>' +
  [
    [
      "Which small developer tools have earned a place in your workflow?",
      "Developers share the little tools they reach for every day, and the habits that make those tools useful.",
      70,
    ],
    [
      "What makes documentation enjoyable to read?",
      "A community discussion about examples, structure, and helping someone find what they need.",
      210,
    ],
  ]
    .map(
      ([title, summary, min], i) =>
        "<entry><id>reddit-demo-" +
        i +
        "</id><title>" +
        title +
        '</title><link href="https://www.reddit.com/r/programming/comments/demo' +
        i +
        '"/><published>' +
        new Date(now - min * 60000).toISOString() +
        "</published><summary>" +
        summary +
        "</summary><author><name>community_reader</name></author></entry>",
    )
    .join("") +
  "</feed>";
export function demoTransport(now = () => Date.now()) {
  return async (url, options = {}) => {
    if (options.signal?.aborted) throw new Error("Aborted");
    if (url.includes("stories.json"))
      return { url, status: 200, text: "[101,102,103,104]" };
    const id = Number(url.match(/item\/(\d+)\.json/)?.[1]);
    if (id) {
      const articles = [
        [
          "Show HN: A tiny tool for understanding large codebases",
          "https://github.com",
          184,
          62,
          18,
        ],
        [
          "The quiet engineering behind a reliable text editor",
          "https://example.org/editor",
          97,
          28,
          120,
        ],
        [
          "Ask HN: What have you changed your mind about recently?",
          null,
          142,
          85,
          280,
        ],
        [
          "A visual guide to how databases store your data",
          "https://example.org/databases",
          73,
          19,
          470,
        ],
      ];
      const row = articles[(id - 101) % articles.length];
      return {
        url,
        status: 200,
        text: JSON.stringify({
          id,
          type: "story",
          title: row[0],
          url: row[1],
          score: row[2],
          descendants: row[3],
          time: Math.floor((now() - row[4] * 60000) / 1000),
          by: "curious_builder",
        }),
      };
    }
    return {
      url,
      status: 200,
      text: url.includes("reddit.com") ? atom(now()) : rss(now()),
      etag: '"demo-v1"',
    };
  };
}
