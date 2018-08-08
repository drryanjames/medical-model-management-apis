/** @namespace medmod.apis */
import Grid from 'gridfs-stream';
import { MongoError } from 'mongodb';
import mongoose from "mongoose";
import path from 'path';
import streamifier from 'streamifier';
import {
    arrayProp,
    instanceMethod,
    InstanceType,
    ModelType,
    prop,
    staticMethod,
    Ref,
    Typegoose,
} from "typegoose";
import httpStatus from "http-status";

import APIError from '../helpers/APIError';
import { logger } from '../../config/winston';
import { MeshStorage } from './meshes.storage';
import { User } from '../users/users.model';

const LOG_TAG = "[MeshModels.Model]";


/** Mesh states */
export enum MeshFileExtensions {
    BLEND = 'blend',
    FBX = 'fbx',
    OBJ = 'obj',
    MTL = 'mtl',
    PNG = 'png',
    JPG = 'jpg',
}

/** Represents a gridfs file */
export class GridFSFile extends Typegoose {
    /** The file's name */
    @prop({ required: true })
    filename: string;

    /** The type of the file's content. Used like mimetype */
    @prop({ required: true })
    content_type: string;

    /** Saves original file to gridfs */
    @staticMethod
    static saveFileToGridFS(
        this: ModelType<GridFSFile> & typeof GridFSFile,
        file: Express.Multer.File
    ): Promise<InstanceType<GridFSFile>> {
        logger.info(`${LOG_TAG} saving file to gridfs`);

        return new Promise((fulfill, reject) => {
            // The mongodb instance created when the mongoose.connection is opened
            const db = mongoose.connection.db;

            // The native mongo driver used by mongoose
            const mongoDriver = mongoose.mongo;

            // Create a gridfs-stream
            const gfs = Grid(db, mongoDriver);

            try {
                // Store the file in gridfs
                const writestream = gfs.createWriteStream({
                    filename: file.originalname,
                    mode: 'w',
                    content_type: file.mimetype,
                });
                streamifier.createReadStream(file.buffer).pipe(writestream);

                // Once we're written to gridfs delete the file from the file system and fulfill the response
                writestream.on('close', async (savedFile) => {
                    logger.info(`${LOG_TAG} successfully wrote file '${file.originalname}' to gridfs`);
                    fulfill(savedFile);
                });

                // If there's an error, reject
                writestream.on('error', (err) => {
                    logger.error(`${LOG_TAG} unable to save file '${file.originalname}' to gridfs. Error: ${err}`);
                    reject(err);
                });
            } catch (err) {
                logger.error(`${LOG_TAG} unable to save file '${file.originalname}' to gridfs. Error: ${err}`);
                throw new APIError(`Unable to save file ${file.originalname}`, httpStatus.INTERNAL_SERVER_ERROR);
            }
        });
    }

}

/** Represents an OBJ and MTL file */
export class OBJMTLPair extends Typegoose {
    /** The obj file */
    @prop({ required: true })
    obj: Ref<GridFSFile>;

    /** The mtl file */
    @prop({ required: true })
    mtl: Ref<GridFSFile>;
}

/** File associated with the mesh */
export class MeshFileCollection extends Typegoose {
    /** Array of associated files */
    @arrayProp({ itemsRef: GridFSFile })
    originalFiles: Ref<GridFSFile>[];

    /** Blend file */
    @prop()
    blendFile: Ref<GridFSFile>;

    /** List of obj and mtl files */
    @arrayProp({ itemsRef: OBJMTLPair })
    objMtlFiles: Ref<OBJMTLPair>[];

    /** Saves the given files in the DB and returns a mesh file collection */
    @staticMethod
    static async saveFiles(
        this: ModelType<MeshFileCollection> & typeof MeshFileCollection,
        files: Express.Multer.File[],
    ): Promise<InstanceType<MeshFileCollection>> {
        logger.info(`${LOG_TAG} Attempting to save '${files.length}' mesh files`);

        if (files.length <= 0) {
            // An explination for why I used 400 instead of 422
            // https://stackoverflow.com/questions/16133923/400-vs-422-response-to-post-of-data
            logger.warn(`${LOG_TAG} attempted to upload a mesh without any files`);
            throw new APIError('No mesh files detected', httpStatus.BAD_REQUEST, true);
        }

        // Save each file to the db
        const originalFiles: InstanceType<GridFSFile>[] = [];
        for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
            const file = files[fileIndex];
            const meshFile = await GridFSFileModel.saveFileToGridFS(file);

            // Save a reference to the file so we can create a collection
            originalFiles.push(meshFile);
        }

        try {
            // Return a mesh file collection
            const meshFileCollection = await MeshFileCollectionModel.create({
                originalFiles,
            });

            logger.info(`${LOG_TAG} successfully saved mesh file collection ${meshFileCollection._id}`);

            return meshFileCollection;
        } catch (err) {
            const fileIds: string[] = originalFiles.map(origFile => origFile._id);
            logger.error(`${LOG_TAG} unable to save mesh file collection for files [${fileIds.join(',')}]. Error: ${err}`);
            throw new APIError('Unable to save files', httpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}

/** Mesh states */
export enum ResourceStates {
    DELETED = 'deleted',
    INVALID = 'invalid',
    PROCESSING = 'processing',
    READY = 'ready',
}

/** Represents a Mesh model */
export class Mesh extends Typegoose {
    /** The owner of this model */
    @prop({ ref: User, required: true })
    owner: Ref<User>;

    /** The version of this model */
    @prop({ required: true })
    version: number;

    /** The name of this model */
    @prop({ required: true })
    name: string;

    /** A short description of the model */
    @prop() shortDesc: string;

    /** A long description of the model */
    @prop() longDesc: string;

    /** The state of the model */
    @prop({
        required: true,
        enum: Object.keys(ResourceStates).map(key => ResourceStates[key]),
    })
    state: ResourceStates;

    /** The date the model was created */
    @prop({ default: Date.now })
    created: Date;

    /** The date the model was last accessed */
    @prop({ default: Date.now })
    lastAccessed: Date;

    /** Files associated with this mesh */
    @prop({ required: true })
    files: Ref<MeshFileCollection>;

    /** Returns whether the given user is authorized to interact with this mesh */
    @instanceMethod
    isAuthorized(user: InstanceType<User>): boolean {
        return this.owner.toString() === user._id.toString();
    }

    /**
     * Set the mesh's state
     * @return false if there was an error, true otherwise
     */
    @instanceMethod
    async updateState(this: InstanceType<Mesh>, newState: ResourceStates): Promise<boolean> {
        try {
            logger.req().info(`${LOG_TAG} updating state from ${this.state} to ${newState} for mesh '${this.name}' with id '${this._id}'`);

            // If the states are the same do not update
            if (this.state == newState) {
                logger.req().info(`${LOG_TAG} mesh '${this.name}' with id '${this._id}' already has state ${newState}. Not updating`);
                return true;
            }

            // Update the state
            this.state = newState;
            const updatedMesh = await this.save();

            logger.req().info(`${LOG_TAG} successfully updated state to ${newState} for mesh '${this.name}' with id '${this._id}'`);

            return true;
        } catch (err) {
            logger.req().info(`${LOG_TAG} unable to update state from ${this.state} to ${newState}. Error: ${err}`);
            return false;
        }
    }

    /** Gets a model by its id */
    @staticMethod
    static async get(
        this: ModelType<Mesh> & typeof Mesh,
        user: InstanceType<User>,
        id: string
    ): Promise<InstanceType<Mesh>> {
        logger.req().info(`${LOG_TAG} attempting to get mesh by id '${id}' for user '${user.email}'`);

        try {
            logger.req().info(`${LOG_TAG} getting mesh with id ${id}`);
            const mesh = await this.findById(id).exec();

            // If the mesh does not exist return bad request
            if (!mesh) {
                logger.req().error(`${LOG_TAG} mesh with id '${id}' does not exist`);
                const doesNotExistError = new APIError(`Mesh with id ${id} does not exist`, httpStatus.NOT_FOUND);
                throw doesNotExistError;
            }

            // Make sure the user is authorized to get this mesh
            if (!mesh.isAuthorized(user)) {
                logger.req().error(`${LOG_TAG} user '${user.email}' is not authorized to interact with mesh '${id}'`);
                const unauthorizedError = new APIError(`User '${user.email}' is not authorized to interact with mesh '${id}'`, httpStatus.UNAUTHORIZED);
                throw unauthorizedError;
            }

            logger.req().info(`${LOG_TAG} successfully retrieved mesh '${mesh.name}' by id '${id}' for user '${user.email}'`);
            return mesh;
        } catch (err) {
            logger.req().error(`${LOG_TAG} unable to retrieve mesh by id '${id}'. Err: ${err}`);
            throw err;
        }
    }

    /**
     * Create mesh
     * @param {string} name - The name of the mesh
     * @param {string} shortDesc - a short description of the mesh
     * @param {string} longDesc - a long description of the mesh
     */
    @staticMethod
    static async createMesh(
        this: ModelType<Mesh> & typeof Mesh,
        owner: InstanceType<User>,
        name: string,
        shortDesc: string,
        longDesc: string,
        files: Express.Multer.File[],
    ): Promise<InstanceType<Mesh>> {
        logger.info(`${LOG_TAG} creating new mesh with name '${name}'`);

        const meshFileCollection = await MeshFileCollectionModel.saveFiles(files);

        try {
            const savedMesh = await MeshModel.create({
                owner,
                name,
                shortDesc,
                longDesc,
                files: meshFileCollection,
                version: 1,
                state: ResourceStates.PROCESSING,
            });

            logger.req().info(`${LOG_TAG} Successfully created mesh '${savedMesh._id}' owned by user '${owner.email}'`);
            return savedMesh;
        } catch (err) {
            if (err instanceof MongoError && err.code == 11000) {
                logger.req().error(`${LOG_TAG} user ${owner.email} attempted to create a mesh with name '${name}' but a mesh by that name already exists`);
                const duplicateKeyError = new APIError(`A mesh with name '${name}' already exists`, httpStatus.BAD_REQUEST, true);
                return Promise.reject(duplicateKeyError);
            } else {
                logger.req().error(`${LOG_TAG} error while creating mesh. Error: ${err}`);
                const unknownError = new APIError('Unable to create mesh');
                return Promise.reject(unknownError);
            }
        }
    }
}

export const MeshModel = new Mesh().getModelForClass(Mesh, {
    schemaOptions: { toJSON: { virtuals: true } },
});

export const MeshFileCollectionModel = new MeshFileCollection().getModelForClass(MeshFileCollection, {
    schemaOptions: { toJSON: { virtuals: true } },
});

export const GridFSFileModel = new GridFSFile().getModelForClass(GridFSFile, {
    schemaOptions: {
        collection: 'fs.files',
        toJSON: { virtuals: true }
    },
});

