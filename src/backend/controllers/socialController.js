exports.getFeed = (req, res) => {
  const { userId } = req.params;

  res.json({
    message: "Social feed endpoint stub",
    user_id: Number(userId),
    feed: [
      { username: "basleal", streak_days: 6, update: "Completed Leg Day" },
      { username: "rusanth", streak_days: 4, update: "Completed Core Session" }
    ]
  });
};

exports.followUser = (req, res) => {
  const { follower_id, following_id } = req.body;

  res.status(201).json({
    message: "Follow endpoint stub",
    follower_id,
    following_id
  });
};

exports.unfollowUser = (req, res) => {
  const { follower_id, following_id } = req.body;

  res.json({
    message: "Unfollow endpoint stub",
    follower_id,
    following_id
  });
};
