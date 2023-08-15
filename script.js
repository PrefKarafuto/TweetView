// Function to replace entity references in a text
function replaceEntityReferences(text, userIdMap) {
  return text.replace(/&gt;&gt;(\d+)/g, (match, targetId) => {
    const userId = userIdMap[targetId] || targetId;
    return `<a class="reply" href="#${targetId}">@${userId}</a>`;
  });
}

// Function to extract reply target from a text
function extractReplyTarget(text) {
  const matches = text.match(/&gt;&gt;(\d+)/);
  if (matches && matches.length >= 2) {
    return matches[1];
  }
  return null;
}

// Function to format timestamp
function formatTimestamp(timestamp) {
  const parts = timestamp.match(/(\d+)\/(\d+)\/(\d+)\(.+\) (\d+):(\d+):(\d+) ID:(.+)/);
  if (parts) {
    const year = parts[1];
    const month = ('0' + parts[2]).slice(-2);
    const day = ('0' + parts[3]).slice(-2);
    const hours = parseInt(parts[4]);
    const minutes = ('0' + parts[5]).slice(-2);
    const period = hours < 12 ? '午前' : '午後';
    const formattedHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${period}${formattedHours}:${minutes} · ${year}年${parseInt(month)}月${parseInt(day)}日`;
  }
  return '';
}

async function loadTweetsFromURL(bbs, dat) {
  try {
    const datFileURL = `../${bbs}/dat/${dat}.dat`;
    const response = await fetch(datFileURL);
    const sjisData = new Uint8Array(await response.arrayBuffer());
    const decodedData = new TextDecoder('Shift_JIS').decode(sjisData);
    const tweets = decodedData.trim().split('\n');

    const timeline = document.getElementById('timeline');
    timeline.innerHTML = '';

    const userIdMap = {};
    const tweetReplies = {}; // Store the reply target for each tweet
    const replyCounts = {};

    for (let i = 0; i < tweets.length; i++) {
      const tweetData = tweets[i].replace(/<br>/g,'\n').replace(/<[A-Za-z0-9_"':\/?=& .,]+>/g,'')
      .replace(/\n|<hr>/g,'<br>').split('<>');
      if (tweetData.length >= 5) {
        const name = tweetData[0];
        const tweetId = i + 1;
        const timestamp = tweetData[2];
        const userid = tweetData[2].split('ID:')[1];
        userIdMap[tweetId] = userid;
        const content = tweetData[3];
        
        // Extract reply target tweet ID
        const replyTargetId = extractReplyTarget(content);
        const replyTo = replyTargetId ? `<div class="reply-to">返信先: <a href="#${replyTargetId}">#${replyTargetId}</a></div>` : '';

        let replyCount = 0; // Initialize reply count for the tweet
        tweetReplies[tweetId] = []; // Initialize replies for the tweet
        for (let j = i - 1; j >= 0; j--) {
          const replyTargetId = extractReplyTarget(tweets[j].split('<>')[3]);
          if (replyTargetId === `${tweetId}`) {
            const replyUserId = userIdMap[j + 1] || (j + 1);
            const replyContent = tweets[j].split('<>')[3];
            const replyTweet = `
              <div class="reply-tweet" name="reply-${j + 1}">
                <a href="#${j + 1}" class="reply-link">@${replyUserId}</a>
                ${replyContent}
              </div>
            `;
            tweetReplies[tweetId].unshift(replyTweet); // Add reply to the beginning of the list
            replyCount++; // Increment the reply count
          }
        }
        replyCounts[tweetId] = replyCount; // Store the reply count for the tweet

        const tweetElement = document.createElement('div');
        tweetElement.className = 'tweet';
        if (replyTargetId) {
          tweetElement.setAttribute('target', replyTargetId);
          tweetElement.classList.replace('tweet', 'reply-tweet');
        }
        const contentWithLinks = replaceEntityReferences(content, userIdMap)
          .replace(/(https?:\/\/([^\s][^<]+))/g, '<a class="external-link" href="$1" target="_blank">$2</a>');
        tweetElement.innerHTML = `
          <div class="tweet-header">
            <div class="profile-icon"></div>
            <div class="user-info">
              <span class="name">${name}</span><br>
              <span class="userid">@${userid}</span>
            </div>
          </div>
          <div class="tweet-content">${contentWithLinks}</div>
          <span class="timestamp">${formatTimestamp(timestamp)}</span>
          <div class="reply-count">${replyCounts[tweetId]} リプライ</div>
          <div class="reply-list"></div>
          ${replyTo}
        `;

        tweetElement.setAttribute('name', `${tweetId}`);
        timeline.appendChild(tweetElement);

        // Append replies to the current tweet
        if (tweetReplies[tweetId].length > 0) {
          const repliesContainer = document.createElement('div');
          repliesContainer.className = 'replies';
          repliesContainer.innerHTML = tweetReplies[tweetId].join('');
          tweetElement.appendChild(repliesContainer);
        }
      }
    }

    // Add event listeners for mouseover and mouseout on reply links
    const replyLinks = document.querySelectorAll('.reply-link');
    replyLinks.forEach((link) => {
      const replyId = link.getAttribute('href').substring(1);
      const replyTweet = document.querySelector(`.reply-tweet[name="reply-${replyId}"]`);
      link.addEventListener('mouseover', () => {
        replyTweet.style.display = 'block';
      });
      link.addEventListener('mouseout', () => {
        replyTweet.style.display = 'none';
      });

      // Append replies to the current tweet's container
      const tweetContainer = document.querySelector(`[name="${replyId}"]`);
      const repliesContainer = tweetContainer.querySelector('.replies');
      const replyList = tweetContainer.querySelector('.reply-list'); // Find the reply-list element

      if (repliesContainer) {
        const replies = replyTweet.cloneNode(true);
        replies.style.display = 'block';
        repliesContainer.appendChild(replies);

        // Append the replies to the corresponding reply-list element
        replyList.appendChild(replies);
      }
    });
  } catch (error) {
    const errorMessage = document.getElementById('error-message');
    errorMessage.innerText = 'データの読み込みに失敗しました。';
  }
}

const urlParams = new URLSearchParams(window.location.search);
const bbsParam = urlParams.get('bbs');
const datParam = urlParams.get('dat');
if (bbsParam && datParam) {
  loadTweetsFromURL(bbsParam, datParam);
} else {
  const errorMessage = document.getElementById('error-message');
  errorMessage.innerText = 'URLの引数が不足しています。';
}
