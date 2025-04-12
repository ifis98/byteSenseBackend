# -*- coding: utf-8 -*-
"""
Created on Sat Jan  9 16:33:38 2021

@author: sarna
"""

import numpy as np
import matplotlib.pyplot as plt
import scipy.signal as sig
from sklearn.cluster import DBSCAN

import sys
import json
from pymongo import MongoClient
from bson.objectid import ObjectId

def bruxism_detection(y_pred, eps_val, min_sample_val):
    index = np.where(y_pred == 1500)[0]
    dbscan = DBSCAN(eps=eps_val, min_samples=min_sample_val)
    labels = dbscan.fit_predict(index.reshape(-1,1))
    clusters = list(set(labels))
    bruxism_episode = np.zeros(len(y_pred))
    for cluster in clusters:
        if cluster != -1:
            cluster_index = np.where(labels == cluster)[0]
            begin = cluster_index[0]
            end = cluster_index[-1]
            bruxism_episode[index[begin]:index[end]] = 1
    return bruxism_episode

# GET grind ratio data
def get_grind_ratio(collection, userID):
    document = collection.find_one({'_id': userID})
    #print(document['data'][0])
    return document

#connect to mongodb
def get_mongoConnection():
    client = MongoClient("mongodb+srv://Admin:Admin123@bruxawaycluster.jrsuw.mongodb.net/BruxAway_DB?retryWrites=true&w=majority")
    db = client.get_database('BruxAway_DB')
    grind_collection = db.grindratios
    return grind_collection


def main():
    userID = ObjectId(sys.argv[1])
    collection = get_mongoConnection()
    document = get_grind_ratio(collection, userID)
    #print(document['data'][0])


if __name__ == "__main__":
    main()




file1 = open('Night12.txt', 'r')
Lines = file1.readlines()

data = np.empty([0, 2])
time = np.empty([0, 1])

i=0
while(i<len(Lines)):
    if (Lines[i][:6]=='Device'):
        sen = np.hstack( (4000, 4000) )
        # data = np.vstack((data, sen))
    elif ((ord(Lines[i][0]) <= 57) and (ord(Lines[i][0]) >= 48)) or (Lines[i][0] == '-'):
        d = Lines[i][:-1].split(',')
        sen = np.hstack( (int(d[0]), int(d[1])) )
        data = np.vstack((data, sen))
        i+=1
        t = Lines[i][16:24].split(':')
        sec = int(t[0])*3600 + int(t[1])*60 + int(t[2])
        time = np.append(time, sec)
    i+=1

time = time - 3600
# plt.plot(data[:,0])
# plt.plot(time, data[:,1], 'go')
file1.close()
# exit()



settling = 128
brux = np.empty([0, 2])
clench = np.empty([0, 2])
clench = np.vstack((clench, data[0,:]))
for i in range(1,len(data)):
    # if( data[i,0] < clench[i-1,0]+50 ):
    avg = clench[i-1,:] + (data[i,:]-clench[i-1,:])/settling
    clench = np.vstack((clench, avg))
    brux = np.vstack((brux, 1500*(data[i,:]>clench[i-1,:]+200) ))
plt.figure(1)
plt.plot(brux[:,0])
plt.plot(data[:,0])
plt.figure(2)
plt.plot(brux[:,1])
plt.plot(data[:,1])
# exit()

ttt = bruxism_detection(brux[:,0],40,2)
plt.figure(3)
plt.plot(data[:,0])
plt.plot(ttt*1500)






