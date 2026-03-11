import mongoose from 'mongoose';
import { Category, ICategory } from '../models/Category';
import { Post } from '../models/Post';

/**
 * Category Service
 * 
 * Handles category management and post count tracking
 */

export interface CreateCategoryData {
  name: string;
  color?: string;
  description?: string;
  icon?: string;
}

export interface UpdateCategoryData {
  name?: string;
  color?: string;
  description?: string;
  icon?: string;
}

export class CategoryService {
  /**
   * Get all categories for a workspace
   */
  static async getCategories(workspaceId: string): Promise<ICategory[]> {
    return Category.find({ workspaceId: new mongoose.Types.ObjectId(workspaceId) })
      .sort({ name: 1 })
      .exec();
  }

  /**
   * Create a new category
   */
  static async createCategory(
    workspaceId: string,
    userId: string,
    data: CreateCategoryData
  ): Promise<ICategory> {
    const category = new Category({
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      createdBy: new mongoose.Types.ObjectId(userId),
      ...data,
    });

    return category.save();
  }

  /**
   * Update a category
   */
  static async updateCategory(
    id: string,
    workspaceId: string,
    data: UpdateCategoryData
  ): Promise<ICategory | null> {
    return Category.findOneAndUpdate(
      { 
        _id: new mongoose.Types.ObjectId(id),
        workspaceId: new mongoose.Types.ObjectId(workspaceId)
      },
      data,
      { new: true }
    ).exec();
  }

  /**
   * Delete a category and remove it from all posts
   */
  static async deleteCategory(id: string, workspaceId: string): Promise<void> {
    const categoryId = new mongoose.Types.ObjectId(id);
    const workspaceObjectId = new mongoose.Types.ObjectId(workspaceId);

    // Remove category from all posts
    await Post.updateMany(
      { 
        categoryId,
        workspaceId: workspaceObjectId
      },
      { $unset: { categoryId: 1 } }
    );

    // Delete the category
    await Category.findOneAndDelete({
      _id: categoryId,
      workspaceId: workspaceObjectId
    });
  }

  /**
   * Increment post count for a category
   */
  static async incrementPostCount(categoryId: string): Promise<void> {
    await Category.findByIdAndUpdate(
      new mongoose.Types.ObjectId(categoryId),
      { $inc: { postCount: 1 } }
    );
  }

  /**
   * Decrement post count for a category
   */
  static async decrementPostCount(categoryId: string): Promise<void> {
    await Category.findByIdAndUpdate(
      new mongoose.Types.ObjectId(categoryId),
      { $inc: { postCount: -1 } }
    );
  }

  /**
   * Recalculate post count for a category
   */
  static async recalculatePostCount(categoryId: string): Promise<void> {
    const postCount = await Post.countDocuments({
      categoryId: new mongoose.Types.ObjectId(categoryId)
    });

    await Category.findByIdAndUpdate(
      new mongoose.Types.ObjectId(categoryId),
      { postCount }
    );
  }

  /**
   * Recalculate post counts for all categories in a workspace
   */
  static async recalculateAllPostCounts(workspaceId: string): Promise<void> {
    const categories = await Category.find({
      workspaceId: new mongoose.Types.ObjectId(workspaceId)
    });

    for (const category of categories) {
      await this.recalculatePostCount(category._id.toString());
    }
  }
}