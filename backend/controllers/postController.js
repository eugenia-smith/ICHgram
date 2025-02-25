import Post from "../models/postModel.js";
import User from "../models/userModel.js";
import Like from "../models/likeModel.js";
import Follow from "../models/followModel.js";
import Comment from "../models/commentModel.js";

export const getPosts = async (req, res) => {
  try {
    const explore = req.query.explore || !req.user;

    let posts;

    if (explore) {
      // Если режим "исследования", получаем все посты
      posts = await Post.find().populate("user", "name");
    } else {
      // Ищем пользователей, которых фолловит текущий
      const follows = await Follow.find({ follower: req.user });
      const userIds = follows.map((follow) => follow.user);

      // Получаем посты только этих пользователей
      posts = await Post.find({ user: { $in: userIds } }).populate(
        "user",
        "name"
      );
    }

    // Получаем данные для постов параллельно
    const updatedPosts = await Promise.all(
      posts.map(async (post) => {
        const isLiked = await Like.findOne({
          post: post._id,
          user: req.user,
        });
        const commentCount = await Comment.countDocuments({ post: post._id });
        const likeCount = await Like.countDocuments({ post: post._id });
        const user = post.user.toJSON();
        user.isMe = post.user._id.equals(req.user);
        user.isFollowing = !!(await Follow.findOne({
          user: post.user._id,
          follower: req.user,
        }));

        return {
          ...post.toJSON(),
          isLiked: !!isLiked,
          commentCount,
          likeCount,
          user,
        };
      })
    );

    res.status(200).json(updatedPosts);
  } catch (error) {
    console.error("Error retrieving posts:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).populate("user", "name");

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const user = { _id: post.user._id, name: post.user.name };
    user.isMe = post.user._id.equals(req.user);
    user.isFollowing = !!(await Follow.findOne({
      user: post.user._id,
      follower: req.user,
    }));
    const comments = await Comment.find({ post: req.params.id }).populate(
      "user",
      "name"
    );

    const likeCount = await Like.countDocuments({
      post: req.params.id,
    });

    const isLiked = !!(await Like.findOne({
      post: req.params.id,
      user: req.user,
    }));

    const response = {
      ...post.toJSON(),
      comments,
      likeCount,
      isLiked,
      user,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Error retrieving post:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const addPost = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Image is not provided." });
    }

    const imageBuffer = req.file.buffer;
    const imageBase64 = imageBuffer.toString("base64");

    const { text } = req.body;
    const post = new Post({
      photo: `data:image/jpeg;base64,${imageBase64}`,
      text,
      user: req.user,
    });
    await post.save();
    res.status(201).json({ message: "Post has been added", post: post });
  } catch (error) {
    console.error("Error adding post:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const updatePost = async (req, res) => {
  try {
    const { img, text } = req.body;
    const post = await Post.findOneAndUpdate(
      { _id: req.params.id, user: req.user }, // Проверяем, что пост принадлежит текущему пользователю
      { photo: img, text },
      { new: true, runValidators: true }
    );

    if (!post) {
      return res
        .status(404)
        .json({ message: "Post not found or unauthorized" });
    }
    res.status(200).json({ message: "Post has been updated", post: post });
  } catch (error) {
    console.error("Error updating post:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const deletePost = async (req, res) => {
  try {
    await Comment.deleteMany({ post: req.params.id });
    await Like.deleteMany({ post: req.params.id });
    const post = await Post.findOneAndDelete({
      _id: req.params.id,
      user: req.user, // Проверяем, что пост принадлежит текущему пользователю
    });

    if (!post) {
      return res
        .status(404)
        .json({ message: "Post not found or unauthorized" });
    }
    res.status(200).json({ message: "Post has been deleted" });
  } catch (error) {
    console.error("Error deleting post:", error);
    res.status(500).json({ message: "Server error" });
  }
};
